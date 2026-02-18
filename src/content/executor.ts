/**
 * Tool Execution — Content Script
 *
 * Handles tool call requests from the service worker.
 * Routes to either native WebMCP execution or DOM-fallback execution.
 *
 * Post-action data extraction:
 *   1. If interceptionConfig provided → captures the site's API response
 *   2. Else → accessible text extraction from the page
 */

import type { ExecuteToolMessage } from '../shared/messages';
import { interceptOnce } from './api-interceptor';
import { extractAccessibleContent } from './a11y-extractor';

interface ExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Set up the tool execution listener.
 * Called from the content script entry point.
 */
export function startExecutor(): void {
  chrome.runtime.onMessage.addListener((msg: ExecuteToolMessage, _sender, sendResponse) => {
    if (msg.type !== 'EXECUTE_TOOL') return;

    executeToolCall(msg)
      .then(sendResponse)
      .catch(err => {
        sendResponse({
          success: false,
          message: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        });
      });

    return true; // Async response
  });
}

async function executeToolCall(msg: ExecuteToolMessage): Promise<ExecutionResult> {
  if (msg.source === 'webmcp-native') {
    return executeNativeTool(msg.toolName, msg.arguments);
  } else {
    return executeDomTool(msg.toolName, msg.arguments, msg.selector, msg.interceptionConfig);
  }
}

// ─── Native WebMCP Execution ───

async function executeNativeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ExecutionResult> {
  if (!('modelContext' in navigator)) {
    return { success: false, message: 'WebMCP API not available on this page' };
  }

  const modelContext = (navigator as any).modelContext;

  try {
    // Get the tool's execute function
    let tool: any;
    if (typeof modelContext.getTool === 'function') {
      tool = await modelContext.getTool(toolName);
    } else if (typeof modelContext.getTools === 'function') {
      const tools = await modelContext.getTools();
      tool = tools?.find((t: any) => t.name === toolName);
    }

    if (!tool || typeof tool.execute !== 'function') {
      return { success: false, message: `Native tool "${toolName}" not found or not executable` };
    }

    const result = await tool.execute(args);

    // WebMCP tools can return MCP-style content arrays or plain values
    if (result?.content) {
      const textContent = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      return { success: true, message: textContent, data: result };
    }

    return {
      success: true,
      message: typeof result === 'string' ? result : JSON.stringify(result),
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      message: `Native tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── DOM Fallback Execution ───

async function executeDomTool(
  _toolName: string,
  args: Record<string, unknown>,
  selector?: string,
  interceptionConfig?: ExecuteToolMessage['interceptionConfig'],
): Promise<ExecutionResult> {
  if (!selector) {
    return { success: false, message: 'No selector provided for DOM fallback tool' };
  }

  const element = document.querySelector(selector);
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` };
  }

  // Set up API interceptor BEFORE triggering the action (if configured)
  let interceptPromise: Promise<import('./api-interceptor').InterceptResult> | null = null;
  if (interceptionConfig) {
    interceptPromise = interceptOnce({
      urlPattern: interceptionConfig.isRegex
        ? new RegExp(interceptionConfig.urlPattern)
        : interceptionConfig.urlPattern,
      method: interceptionConfig.method,
      extractFields: interceptionConfig.extractFields,
      timeout: interceptionConfig.waitMs,
    });
  }

  // ─── Execute the Action ───
  let actionResult: ExecutionResult;

  if (element instanceof HTMLFormElement) {
    actionResult = executeFormTool(element, args);
  } else if (element instanceof HTMLInputElement) {
    actionResult = executeSearchTool(element, args);
  } else if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) {
    element.click();
    actionResult = { success: true, message: `Clicked: ${element.textContent?.trim() ?? selector}` };
  } else {
    return { success: false, message: `Unsupported element type: ${element.tagName}` };
  }

  if (!actionResult.success) return actionResult;

  // ─── Post-Action Data Extraction ───
  const extractedData = await extractPostActionData(interceptPromise);

  if (extractedData) {
    return {
      success: true,
      message: actionResult.message,
      data: extractedData,
    };
  }

  return actionResult;
}

/**
 * Extract data after a tool action completes.
 *
 * Priority:
 *   1. API interception (if configured and captured a response)
 *   2. Accessible text extraction (universal fallback)
 */
async function extractPostActionData(
  interceptPromise: Promise<import('./api-interceptor').InterceptResult> | null,
): Promise<unknown | null> {
  // 1. Try API interception first
  if (interceptPromise) {
    const result = await interceptPromise;
    if (result.success && result.data.length > 0) {
      return {
        source: 'api-interception',
        results: result.data,
        matchedUrl: result.matchedUrl,
      };
    }
  }

  // 2. Fall back to accessible text extraction
  // Wait for DOM to update after the action — uses MutationObserver to resolve
  // as soon as new content appears, rather than an arbitrary fixed delay.
  await waitForDomUpdate();

  const a11yResult = extractAccessibleContent();
  if (a11yResult.listItems.length > 0 || a11yResult.mainContent.length > 50) {
    return {
      source: 'accessible-text',
      title: a11yResult.title,
      headings: a11yResult.headings,
      listItems: a11yResult.listItems.slice(0, 20),
      contentPreview: a11yResult.mainContent.slice(0, 1500),
      truncated: a11yResult.truncated,
    };
  }

  return null;
}

/**
 * Wait for the DOM to update after a tool action.
 * Resolves as soon as a meaningful mutation is observed, or after 300ms max.
 */
function waitForDomUpdate(): Promise<void> {
  return new Promise(resolve => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      clearTimeout(fallback);
      resolve();
    };

    const observer = new MutationObserver((mutations) => {
      // Only resolve on meaningful changes (added nodes, not just attribute tweaks)
      const hasMeaningfulChange = mutations.some(m =>
        m.addedNodes.length > 0 || m.type === 'childList'
      );
      if (hasMeaningfulChange) done();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Max wait — resolve even if no mutations detected
    const fallback = setTimeout(done, 300);
  });
}

// ─── Form Execution ───

function executeFormTool(form: HTMLFormElement, args: Record<string, unknown>): ExecutionResult {
  let fieldsSet = 0;

  for (const [key, value] of Object.entries(args)) {
    const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!input) continue;

    if (input instanceof HTMLSelectElement) {
      const option = Array.from(input.options).find(o => o.value === String(value));
      if (option) {
        input.value = option.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        fieldsSet++;
      }
    } else if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      input.checked = Boolean(value);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsSet++;
    } else {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set ?? Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(input, String(value));
      } else {
        input.value = String(value);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsSet++;
    }
  }

  if (fieldsSet === 0) {
    return { success: false, message: 'No form fields matched the provided arguments' };
  }

  const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitButton instanceof HTMLElement) {
    submitButton.click();
  } else {
    form.requestSubmit();
  }

  return {
    success: true,
    message: `Form submitted with ${fieldsSet} field(s) filled`,
  };
}

// ─── Search Execution ───

function executeSearchTool(input: HTMLInputElement, args: Record<string, unknown>): ExecutionResult {
  const query = String(args.query ?? args.value ?? args.q ?? '');
  if (!query) {
    return { success: false, message: 'No query provided for search tool' };
  }

  // Focus the input first
  input.focus();

  // Set value using native setter (works with React/Vue controlled inputs)
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, query);
  } else {
    input.value = query;
  }

  // Fire input/change so React/Vue state updates
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  // Dispatch Enter on the input — most SPAs listen for keyboard events
  // Use setTimeout so React has time to process the value change
  setTimeout(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

    // Also try form submit as a fallback for traditional forms
    const form = input.closest('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn instanceof HTMLElement) {
        submitBtn.click();
      }
    }
  }, 50);

  return { success: true, message: `Search executed: "${query}"` };
}
