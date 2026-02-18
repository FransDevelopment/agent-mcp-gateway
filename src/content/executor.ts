/**
 * Tool Execution — Content Script
 *
 * Handles tool call requests from the service worker.
 * Routes to either native WebMCP execution or DOM-fallback execution.
 */

import type { ExecuteToolMessage } from '../shared/messages';

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
    return executeDomTool(msg.toolName, msg.arguments, msg.selector);
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
): Promise<ExecutionResult> {
  if (!selector) {
    return { success: false, message: 'No selector provided for DOM fallback tool' };
  }

  const element = document.querySelector(selector);
  if (!element) {
    return { success: false, message: `Element not found: ${selector}` };
  }

  // ─── Form Execution ───
  if (element instanceof HTMLFormElement) {
    return executeFormTool(element, args);
  }

  // ─── Search Input Execution ───
  if (element instanceof HTMLInputElement) {
    return executeSearchTool(element, args);
  }

  // ─── Button Execution ───
  if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) {
    element.click();
    return { success: true, message: `Clicked: ${element.textContent?.trim() ?? selector}` };
  }

  return { success: false, message: `Unsupported element type: ${element.tagName}` };
}

function executeFormTool(form: HTMLFormElement, args: Record<string, unknown>): ExecutionResult {
  let fieldsSet = 0;

  for (const [key, value] of Object.entries(args)) {
    const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!input) continue;

    if (input instanceof HTMLSelectElement) {
      // Set select value
      const option = Array.from(input.options).find(o => o.value === String(value));
      if (option) {
        input.value = option.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        fieldsSet++;
      }
    } else if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      // Set checkbox
      input.checked = Boolean(value);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsSet++;
    } else {
      // Text input, textarea, etc.
      // Use nativeInputValueSetter to work with React/Vue controlled inputs
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

  // Submit the form
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

function executeSearchTool(input: HTMLInputElement, args: Record<string, unknown>): ExecutionResult {
  const query = String(args.query ?? args.value ?? args.q ?? '');
  if (!query) {
    return { success: false, message: 'No query provided for search tool' };
  }

  // Set value using native setter (works with React/Vue)
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, query);
  } else {
    input.value = query;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  // Try to submit: look for a search button or press Enter
  const form = input.closest('form');
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button[aria-label*="search"]');
    if (submitBtn instanceof HTMLElement) {
      submitBtn.click();
    } else {
      form.requestSubmit();
    }
  } else {
    // No form — dispatch Enter keypress
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  }

  return { success: true, message: `Search executed: "${query}"` };
}
