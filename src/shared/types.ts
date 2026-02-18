// ─── JSON Schema (subset used for tool input schemas) ───

export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JSONSchemaProperty;
}

// ─── Tool Discovery ───

export type ToolSource = 'webmcp-native' | 'webmcp-declarative' | 'curated-bundle' | 'community-registry' | 'dom-fallback';

export type AuthState = 'authenticated' | 'unknown' | 'login-required';

/**
 * A tool discovered by the content script on a page.
 * This is the raw discovery payload before it's enriched by the registry.
 */
export interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  source: ToolSource;
  /** CSS selector for DOM-fallback tools (used to re-target the element on execution) */
  selector?: string;
}

/**
 * A tool registered in the service worker's central registry.
 * Enriched with tab/origin context and lifecycle metadata.
 */
export interface RegisteredTool {
  /** Unique ID: `${origin}::${name}` */
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  source: ToolSource;
  /** Origin where the tool was discovered, e.g. "https://mail.google.com" */
  origin: string;
  /** Chrome tab ID where the tool lives */
  tabId: number;
  /** URL at the time of discovery (used for re-verification) */
  url: string;
  discoveredAt: number;
  lastVerified: number;
  authState: AuthState;
  /** CSS selector for DOM-fallback execution */
  selector?: string;
}

// ─── MCP Protocol Types ───

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface MCPToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── Extension ↔ Dash Communication ───

export interface GatewayRegistrationPayload {
  tools: RegisteredTool[];
  extensionVersion: string;
  timestamp: number;
}

export interface GatewayToolCallRequest {
  toolId: string;
  arguments: Record<string, unknown>;
  requestId: string;
  timeout?: number;
}

export interface GatewayToolCallResponse {
  requestId: string;
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}
