import { toolRegistry } from './tool-registry';
import { GATEWAY_NAME, GATEWAY_VERSION, TOOL_EXECUTION_TIMEOUT } from '../shared/constants';
import type { ExecuteToolMessage } from '../shared/messages';
import type { MCPToolCallResult } from '../shared/types';
import { reportExecution } from '../registry/client';
import { getRegistrySettings } from '../registry/settings';

/**
 * MCP Server that exposes discovered WebMCP tools to any MCP client.
 *
 * Uses Chrome Extension externally_connectable messaging as the transport.
 * External MCP clients (Dash, Claude Desktop, etc.) connect via
 * chrome.runtime.sendMessage(extensionId, ...).
 *
 * Protocol: JSON-RPC 2.0 subset compatible with MCP specification.
 */

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Connected Client Tracking ───

/** Set of sender origin URLs of currently connected MCP clients. */
const connectedClients = new Set<string>();

/**
 * Get the number of currently connected external MCP clients.
 */
export function getConnectedClientCount(): number {
  return connectedClients.size;
}

/**
 * Get the list of connected client origins for diagnostics.
 */
export function getConnectedClientOrigins(): string[] {
  return Array.from(connectedClients);
}

/**
 * Handle an incoming MCP request from an external client.
 * Returns the MCP response payload.
 */
export async function handleMCPRequest(
  request: MCPRequest,
  senderOrigin?: string,
): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        // Track the connected client
        if (senderOrigin) {
          connectedClients.add(senderOrigin);
          console.log(`[MCPServer] Client connected from ${senderOrigin} (${connectedClients.size} total)`);
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true },
            },
            serverInfo: {
              name: GATEWAY_NAME,
              version: GATEWAY_VERSION,
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolRegistry.getForMCP(),
          },
        };

      case 'tools/call':
        return {
          jsonrpc: '2.0',
          id,
          result: await executeToolCall(
            params?.name as string,
            (params?.arguments ?? {}) as Record<string, unknown>,
          ),
        };

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'notifications/initialized':
        // Client acknowledgment after initialize — no-op
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message },
    };
  }
}

/**
 * Execute a tool call by routing it to the correct tab's content script.
 */
async function executeToolCall(
  mcpToolName: string,
  args: Record<string, unknown>,
): Promise<MCPToolCallResult> {
  const tool = toolRegistry.resolveFromMCPName(mcpToolName);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Tool not found: ${mcpToolName}` }],
      isError: true,
    };
  }

  if (tool.authState === 'login-required') {
    return {
      content: [{
        type: 'text',
        text: `Authentication required for ${tool.origin}. Please log in to the site and try again.`,
      }],
      isError: true,
    };
  }

  // Curated tools with no tab binding yet
  if (tool.tabId === -1) {
    return {
      content: [{
        type: 'text',
        text: `Tool "${tool.name}" is available but no browser tab is open for ${tool.origin}. Please open the site in a tab first.`,
      }],
      isError: true,
    };
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const message: ExecuteToolMessage = {
    type: 'EXECUTE_TOOL',
    toolName: tool.name,
    arguments: args,
    source: tool.source,
    selector: tool.selector,
    requestId,
  };

  try {
    const result = await Promise.race([
      chrome.tabs.sendMessage(tool.tabId, message),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_EXECUTION_TIMEOUT)
      ),
    ]);

    // Report success
    reportExecutionIfEnabled(tool.origin, tool.name, true);

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // If tab doesn't exist, clean up the tool
    if (errorMsg.includes('Could not establish connection') ||
      errorMsg.includes('No tab with id')) {
      toolRegistry.unregister(tool.id);
    }

    // Report failure
    reportExecutionIfEnabled(tool.origin, tool.name, false);

    return {
      content: [{ type: 'text', text: `Execution failed: ${errorMsg}` }],
      isError: true,
    };
  }
}

/**
 * Report execution result if user has opted in.
 * Best-effort — never blocks tool execution.
 */
function reportExecutionIfEnabled(origin: string, toolName: string, success: boolean): void {
  getRegistrySettings().then(settings => {
    if (settings.reportExecutions) {
      reportExecution(origin, toolName, success);
    }
  }).catch(() => { });
}

/**
 * Set up the MCP server listener for external connections.
 * External clients connect via chrome.runtime.sendMessage(EXTENSION_ID, request).
 */
export function startMCPServer(): void {
  chrome.runtime.onMessageExternal.addListener(
    (message: MCPRequest, sender, sendResponse) => {
      if (message.jsonrpc !== '2.0') return;

      const senderOrigin = sender.origin ?? sender.url;

      handleMCPRequest(message, senderOrigin)
        .then(sendResponse)
        .catch(err => {
          sendResponse({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32603, message: err.message },
          });
        });

      return true; // Async response
    }
  );

  // Notify connected clients when tools change
  toolRegistry.onChange(() => {
    // Notify internal popup
    chrome.runtime.sendMessage({ type: 'tools_changed' }).catch(() => {
      // No popup open — ignore
    });

    // Note: externally_connectable is request/response only — we can't push
    // notifications to external clients. They should poll tools/list periodically
    // or reconnect. The listChanged capability signals that the list may change.
    // When WebSocket transport is added, this becomes a push notification.
  });

  console.log(`[MCPServer] Started (${GATEWAY_NAME} v${GATEWAY_VERSION})`);
}

