/**
 * Dash API Client — Extension Side
 *
 * Handles communication between the extension and Dash's backend.
 * Registers/unregisters discovered tools and receives tool call requests.
 */

import type { RegisteredTool } from '../shared/types';
import { GATEWAY_VERSION } from '../shared/constants';

interface DashConfig {
  /** Dash backend URL, e.g. "https://app.arcede.com" or "http://localhost:3000" */
  baseUrl: string;
  /** API key or session token for authenticating with Dash */
  apiKey: string;
}

let config: DashConfig | null = null;
let wsConnection: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Configuration ───

export async function loadConfig(): Promise<DashConfig | null> {
  const stored = await chrome.storage.sync.get(['dashBaseUrl', 'dashApiKey']);
  if (stored.dashBaseUrl && stored.dashApiKey) {
    config = { baseUrl: stored.dashBaseUrl as string, apiKey: stored.dashApiKey as string };
    return config;
  }
  return null;
}

export async function saveConfig(newConfig: DashConfig): Promise<void> {
  config = newConfig;
  await chrome.storage.sync.set({
    dashBaseUrl: newConfig.baseUrl,
    dashApiKey: newConfig.apiKey,
  });
}

export function getConfig(): DashConfig | null {
  return config;
}

// ─── Tool Registration (REST) ───

/**
 * Register discovered tools with Dash's backend.
 * Called whenever the tool registry changes.
 */
export async function registerToolsWithDash(tools: RegisteredTool[]): Promise<boolean> {
  if (!config) return false;

  try {
    const response = await fetch(`${config.baseUrl}/api/dash/gateway/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Gateway-Version': GATEWAY_VERSION,
      },
      body: JSON.stringify({
        tools,
        extensionVersion: GATEWAY_VERSION,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error(`[DashClient] Registration failed: ${response.status}`);
      return false;
    }

    console.log(`[DashClient] Registered ${tools.length} tools with Dash`);
    return true;
  } catch (err) {
    console.error('[DashClient] Registration error:', err);
    return false;
  }
}

// ─── WebSocket Bridge (for tool execution requests from Dash) ───

type ToolCallHandler = (
  toolId: string,
  args: Record<string, unknown>,
  requestId: string,
) => Promise<{ success: boolean; message: string; data?: unknown }>;

/**
 * Connect to Dash's WebSocket gateway for receiving tool call requests.
 * Dash's handler sends tool calls through this WS when it needs to
 * execute a WebMCP tool in the user's browser.
 */
export function connectWebSocket(onToolCall: ToolCallHandler): void {
  if (!config) {
    console.warn('[DashClient] No config — skipping WebSocket connection');
    return;
  }

  const wsUrl = config.baseUrl
    .replace(/^http/, 'ws')
    + '/api/dash/gateway/ws';

  try {
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
      console.log('[DashClient] WebSocket connected');
      // Authenticate
      wsConnection?.send(JSON.stringify({
        type: 'auth',
        apiKey: config!.apiKey,
        version: GATEWAY_VERSION,
      }));
    };

    wsConnection.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'tool_call') {
          const result = await onToolCall(msg.toolId, msg.arguments, msg.requestId);
          wsConnection?.send(JSON.stringify({
            type: 'tool_result',
            requestId: msg.requestId,
            ...result,
          }));
        }
      } catch (err) {
        console.error('[DashClient] WebSocket message error:', err);
      }
    };

    wsConnection.onclose = () => {
      console.log('[DashClient] WebSocket disconnected');
      wsConnection = null;
      // Reconnect after delay
      scheduleReconnect(onToolCall);
    };

    wsConnection.onerror = (err) => {
      console.error('[DashClient] WebSocket error:', err);
    };
  } catch (err) {
    console.error('[DashClient] WebSocket connection error:', err);
    scheduleReconnect(onToolCall);
  }
}

function scheduleReconnect(onToolCall: ToolCallHandler): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    console.log('[DashClient] Attempting WebSocket reconnect...');
    connectWebSocket(onToolCall);
  }, 5000);
}

export function disconnectWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}
