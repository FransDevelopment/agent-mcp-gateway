import type { RegisteredTool, DiscoveredTool, AuthState, MCPToolDefinition } from '../shared/types';
import {
  MAX_TOOLS_PER_ORIGIN,
  MAX_TOTAL_TOOLS,
  CLOSED_TAB_GRACE_PERIOD,
} from '../shared/constants';

/**
 * Central registry of discovered tools across all tabs.
 *
 * Tools are keyed by `${origin}::${name}` and tied to specific tabs.
 * When a tab closes or navigates away, its tools are cleaned up after
 * a grace period (in case the user navigates back).
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private pendingRemoval = new Map<string, number>(); // toolId → timeout handle
  private listeners: Array<() => void> = [];

  // ─── Registration ───

  register(
    tabId: number,
    url: string,
    origin: string,
    discovered: DiscoveredTool,
    authState: AuthState,
  ): RegisteredTool | null {
    if (this.tools.size >= MAX_TOTAL_TOOLS) {
      console.warn(`[ToolRegistry] Max total tools (${MAX_TOTAL_TOOLS}) reached, skipping`);
      return null;
    }

    const originTools = this.getByOrigin(origin);
    if (originTools.length >= MAX_TOOLS_PER_ORIGIN) {
      console.warn(`[ToolRegistry] Max tools per origin (${MAX_TOOLS_PER_ORIGIN}) for ${origin}, skipping`);
      return null;
    }

    const id = `${origin}::${discovered.name}`;

    // Cancel any pending removal for this tool
    const pendingTimeout = this.pendingRemoval.get(id);
    if (pendingTimeout !== undefined) {
      clearTimeout(pendingTimeout);
      this.pendingRemoval.delete(id);
    }

    const tool: RegisteredTool = {
      id,
      name: discovered.name,
      description: discovered.description,
      inputSchema: discovered.inputSchema,
      source: discovered.source,
      origin,
      tabId,
      url,
      discoveredAt: Date.now(),
      lastVerified: Date.now(),
      authState,
      selector: discovered.selector,
    };

    this.tools.set(id, tool);
    this.notifyListeners();
    console.log(`[ToolRegistry] Registered: ${id} (source: ${discovered.source})`);
    return tool;
  }

  /**
   * Register curated tool definitions (pre-bundled with the extension).
   * These are not tied to a specific tab until the user navigates to
   * the matching origin.
   */
  registerCurated(
    origin: string,
    tools: Array<{
      name: string;
      description: string;
      inputSchema: import('../shared/types').JSONSchema;
      selector: string;
    }>,
  ): void {
    for (const tool of tools) {
      const id = `${origin}::${tool.name}`;

      // Don't overwrite live-discovered tools
      if (this.tools.has(id)) continue;

      this.tools.set(id, {
        id,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        source: 'curated-bundle',
        origin,
        tabId: -1, // No tab yet — resolved when user visits the site
        url: origin,
        discoveredAt: Date.now(),
        lastVerified: Date.now(),
        authState: 'unknown',
        selector: tool.selector,
      });
    }

    console.log(`[ToolRegistry] Registered ${tools.length} curated tools for ${origin}`);
    this.notifyListeners();
  }

  /**
   * When a tab navigates to a curated origin, bind curated tools to that tab
   * so they can be executed in the correct context.
   */
  bindCuratedToTab(origin: string, tabId: number, authState: AuthState): void {
    for (const tool of this.tools.values()) {
      if (tool.origin === origin && tool.source === 'curated-bundle') {
        tool.tabId = tabId;
        tool.authState = authState;
        tool.lastVerified = Date.now();
      }
    }
  }

  unregister(toolId: string): void {
    if (this.tools.delete(toolId)) {
      this.notifyListeners();
      console.log(`[ToolRegistry] Unregistered: ${toolId}`);
    }
  }

  // ─── Queries ───

  get(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  getByName(name: string): RegisteredTool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.name === name) return tool;
    }
    return undefined;
  }

  getByOrigin(origin: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(t => t.origin === origin);
  }

  getByTab(tabId: number): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(t => t.tabId === tabId);
  }

  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  get size(): number {
    return this.tools.size;
  }

  // ─── MCP Conversion ───

  /**
   * Convert all registered tools to MCP tool definitions.
   * Tool names are namespaced by origin slug to avoid collisions.
   */
  getForMCP(): MCPToolDefinition[] {
    return this.getAll()
      .filter(tool => {
        // Exclude curated tools that haven't been bound to an active tab yet.
        // tabId === -1 means the user hasn't visited the site since extension loaded.
        if (tool.source === 'curated-bundle' && tool.tabId === -1) return false;
        return true;
      })
      .map(tool => ({
        name: this.toMCPName(tool),
        description: `[${tool.origin}] ${tool.description}`,
        inputSchema: tool.inputSchema,
      }));
  }

  /**
   * Resolve an MCP tool name back to a RegisteredTool.
   */
  resolveFromMCPName(mcpName: string): RegisteredTool | undefined {
    for (const tool of this.tools.values()) {
      if (this.toMCPName(tool) === mcpName) return tool;
    }
    return undefined;
  }

  private toMCPName(tool: RegisteredTool): string {
    const slug = tool.origin
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    return `${slug}__${tool.name}`;
  }

  // ─── Tab Lifecycle ───

  /**
   * Called when a tab is closed. Tools are scheduled for removal after a
   * grace period (user might re-open the page).
   */
  onTabRemoved(tabId: number): void {
    const tabTools = this.getByTab(tabId);
    for (const tool of tabTools) {
      const handle = setTimeout(() => {
        this.unregister(tool.id);
        this.pendingRemoval.delete(tool.id);
      }, CLOSED_TAB_GRACE_PERIOD) as unknown as number;
      this.pendingRemoval.set(tool.id, handle);
    }
    if (tabTools.length > 0) {
      console.log(`[ToolRegistry] Tab ${tabId} closed, ${tabTools.length} tools pending removal`);
    }
  }

  /**
   * Called when a tab navigates to a new URL. If the origin changes,
   * remove tools from the old origin immediately.
   */
  onTabUpdated(tabId: number, newUrl: string): void {
    let newOrigin: string;
    try {
      newOrigin = new URL(newUrl).origin;
    } catch {
      return;
    }

    const tabTools = this.getByTab(tabId);
    for (const tool of tabTools) {
      if (tool.origin !== newOrigin) {
        this.unregister(tool.id);
      }
    }
  }

  /**
   * Update auth state for all tools from a given origin.
   */
  updateAuthState(origin: string, authState: AuthState): void {
    let changed = false;
    for (const tool of this.tools.values()) {
      if (tool.origin === origin && tool.authState !== authState) {
        tool.authState = authState;
        changed = true;
      }
    }
    if (changed) this.notifyListeners();
  }

  // ─── Change Listeners ───

  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (e) { console.error('[ToolRegistry] Listener error:', e); }
    }
  }

  // ─── Serialization (for persistence across service worker restarts) ───

  serialize(): string {
    return JSON.stringify(Array.from(this.tools.values()));
  }

  restore(json: string): void {
    try {
      const tools: RegisteredTool[] = JSON.parse(json);
      // Merge restored tools with existing ones (preserves curated tools
      // that were registered synchronously at startup).
      let restored = 0;
      for (const tool of tools) {
        if (!this.tools.has(tool.id)) {
          this.tools.set(tool.id, tool);
          restored++;
        }
      }
      if (restored > 0) {
        this.notifyListeners();
      }
      console.log(`[ToolRegistry] Restored ${restored} tools from storage (${this.tools.size} total)`);
    } catch (e) {
      console.error('[ToolRegistry] Failed to restore from storage:', e);
    }
  }
}

/** Singleton instance */
export const toolRegistry = new ToolRegistry();
