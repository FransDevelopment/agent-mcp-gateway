/**
 * WebMCP Tool Discovery — Content Script
 *
 * Detects tools registered via the WebMCP `navigator.modelContext` API
 * and reports them to the service worker.
 */

import type { DiscoveredTool, AuthState } from '../shared/types';
import type { PageToolsMessage } from '../shared/messages';
import { AUTH_REQUIRED_INDICATORS, AUTH_PRESENT_INDICATORS } from '../shared/constants';
import { discoverDomTools } from './dom-fallback';

/**
 * Discover all tools available on the current page.
 * Combines native WebMCP tools, declarative WebMCP tools, and DOM-fallback tools.
 */
export async function discoverPageTools(): Promise<void> {
  const tools: DiscoveredTool[] = [];

  // 1. Native WebMCP detection (Imperative API — navigator.modelContext)
  const nativeTools = await discoverNativeTools();
  tools.push(...nativeTools);

  // 2. Declarative WebMCP detection (HTML attribute API — data-mcp-tool on forms)
  const declarativeTools = discoverDeclarativeTools();
  tools.push(...declarativeTools);

  // 3. DOM fallback — always runs, deduplicates against native/declarative tools.
  // This catches forms the site didn't explicitly declare via WebMCP.
  {
    const domTools = discoverDomTools();

    // Deduplicate: skip DOM tools whose names collide with higher-fidelity sources
    const knownNames = new Set(tools.map(t => t.name));
    const uniqueDomTools = domTools.filter(t => !knownNames.has(t.name));
    tools.push(...uniqueDomTools);
  }

  // NOTE: Do NOT return early if tools.length === 0.
  // The service worker needs the PAGE_TOOLS message to bind curated tools
  // to this tab, even when no DOM/WebMCP tools are discovered.

  // 4. Detect auth state
  const authState = detectAuthState();

  // 5. Report to service worker
  const message: PageToolsMessage = {
    type: 'PAGE_TOOLS',
    origin: window.location.origin,
    url: window.location.href,
    tools,
    authState,
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // Extension context invalidated — page outlived the extension
  });

  console.log(
    `[AgentGateway] Discovered ${tools.length} tools ` +
    `(${nativeTools.length} native, ${declarativeTools.length} declarative, ` +
    `${tools.length - nativeTools.length - declarativeTools.length} DOM fallback)`
  );
}

/**
 * Discover tools registered via the WebMCP `navigator.modelContext` API.
 */
async function discoverNativeTools(): Promise<DiscoveredTool[]> {
  // Check if the WebMCP API is available
  if (!('modelContext' in navigator)) return [];

  const modelContext = (navigator as any).modelContext;
  const tools: DiscoveredTool[] = [];

  try {
    // Enumerate already-registered tools
    if (typeof modelContext.getTools === 'function') {
      const registered = await modelContext.getTools();
      if (Array.isArray(registered)) {
        for (const tool of registered) {
          tools.push({
            name: tool.name,
            description: tool.description ?? `Tool: ${tool.name}`,
            inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
            source: 'webmcp-native',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[AgentGateway] Error reading modelContext tools:', err);
  }

  return tools;
}

/**
 * Discover tools declared via WebMCP Declarative API (HTML attributes).
 *
 * Sites can mark forms as agent-accessible tools using attributes:
 *   <form data-mcp-tool="search_products" data-mcp-description="Search product catalog">
 *     <input name="query" data-mcp-param-description="Search query" required>
 *     <input name="category" data-mcp-param-description="Product category">
 *   </form>
 *
 * This is simpler than the Imperative API (navigator.modelContext) and
 * gives sites a zero-JavaScript way to expose tools to agents.
 *
 * NOTE: Attribute names (data-mcp-tool, data-mcp-description, etc.) are
 * based on Google's early preview signals. These will be updated once the
 * W3C spec stabilizes the exact attribute naming convention.
 */
function discoverDeclarativeTools(): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];

  // Scan for forms with the data-mcp-tool attribute
  const mcpForms = document.querySelectorAll('form[data-mcp-tool]');

  for (const form of mcpForms) {
    const name = form.getAttribute('data-mcp-tool');
    if (!name) continue;

    const description = form.getAttribute('data-mcp-description')
      ?? `Tool: ${name} on ${document.title}`;

    // Build input schema from form inputs that have MCP param attributes
    const inputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    );

    const properties: Record<string, import('../shared/types').JSONSchemaProperty> = {};
    const required: string[] = [];

    for (const input of inputs) {
      const paramName = input.getAttribute('name');
      if (!paramName) continue;

      const paramDesc = input.getAttribute('data-mcp-param-description')
        ?? input.getAttribute('aria-label')
        ?? input.getAttribute('placeholder')
        ?? paramName;

      const paramType = input.getAttribute('data-mcp-param-type')
        ?? mapInputTypeToSchema((input as HTMLInputElement).type ?? 'text');

      properties[paramName] = {
        type: paramType,
        description: paramDesc,
      };

      // Handle select options
      if (input instanceof HTMLSelectElement) {
        const options = Array.from(input.options)
          .filter(o => o.value && o.value !== '')
          .map(o => o.value);
        if (options.length > 0 && options.length <= 20) {
          properties[paramName].enum = options;
        }
      }

      if (input.hasAttribute('required') || input.getAttribute('data-mcp-required') === 'true') {
        required.push(paramName);
      }
    }

    tools.push({
      name,
      description,
      inputSchema: { type: 'object', properties, required },
      source: 'webmcp-declarative',
      selector: uniqueSelectorForForm(form as HTMLFormElement),
    });
  }

  return tools;
}

/**
 * Map HTML input type to JSON Schema type string.
 */
function mapInputTypeToSchema(htmlType: string): string {
  switch (htmlType) {
    case 'number':
    case 'range':
      return 'number';
    case 'checkbox':
      return 'boolean';
    default:
      return 'string';
  }
}

/**
 * Generate a CSS selector for a form element (used for execution targeting).
 */
function uniqueSelectorForForm(form: HTMLFormElement): string {
  if (form.id) return `#${CSS.escape(form.id)}`;

  // Use data-mcp-tool attribute as a reliable selector
  const toolName = form.getAttribute('data-mcp-tool');
  if (toolName) return `form[data-mcp-tool="${CSS.escape(toolName)}"]`;

  // Fallback to positional selector
  const forms = Array.from(document.querySelectorAll('form[data-mcp-tool]'));
  const index = forms.indexOf(form);
  return `form[data-mcp-tool]:nth-of-type(${index + 1})`;
}

/**
 * Set up a listener for dynamically registered WebMCP tools.
 * Some pages register tools after initial load (SPAs, lazy modules).
 */
export function watchForNewTools(): void {
  if (!('modelContext' in navigator)) return;

  const modelContext = (navigator as any).modelContext;

  // Listen for new tool registrations
  if (typeof modelContext.addEventListener === 'function') {
    modelContext.addEventListener('toolregistered', (event: any) => {
      const detail = event.detail ?? event;
      chrome.runtime.sendMessage({
        type: 'TOOL_DISCOVERED',
        origin: window.location.origin,
        url: window.location.href,
        tool: {
          name: detail.name,
          description: detail.description ?? `Tool: ${detail.name}`,
          inputSchema: detail.inputSchema ?? { type: 'object', properties: {} },
          source: 'webmcp-native' as const,
        },
      }).catch(() => { });
    });

    modelContext.addEventListener('toolunregistered', (event: any) => {
      const detail = event.detail ?? event;
      chrome.runtime.sendMessage({
        type: 'TOOL_REMOVED',
        origin: window.location.origin,
        toolName: detail.name,
      }).catch(() => { });
    });
  }
}

/**
 * Detect whether the user is authenticated on the current page.
 * Uses heuristic DOM inspection — not foolproof but useful for
 * signaling to the agent whether a tool call will likely succeed.
 */
function detectAuthState(): AuthState {
  // Check for login/auth forms → likely not authenticated
  for (const selector of AUTH_REQUIRED_INDICATORS) {
    if (document.querySelector(selector)) {
      return 'login-required';
    }
  }

  // Check for user menu / avatar → likely authenticated
  for (const selector of AUTH_PRESENT_INDICATORS) {
    if (document.querySelector(selector)) {
      return 'authenticated';
    }
  }

  return 'unknown';
}
