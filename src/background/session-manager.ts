import { toolRegistry } from './tool-registry';
import { BLOCKED_ORIGINS } from '../shared/constants';
import { hasCuratedDefinitions } from '../curated/index';
import type { ContentToBackgroundMessage } from '../shared/messages';

/**
 * Manages tab lifecycle events and routes messages between
 * content scripts and the tool registry.
 */
export function startSessionManager(): void {
  // ─── Tab Lifecycle ───

  chrome.tabs.onRemoved.addListener((tabId) => {
    toolRegistry.onTabRemoved(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      toolRegistry.onTabUpdated(tabId, changeInfo.url);
    }

    // When a page finishes loading, ask the content script to re-discover tools
    if (changeInfo.status === 'complete') {
      chrome.tabs.sendMessage(tabId, { type: 'DISCOVER_TOOLS' }).catch(() => {
        // Content script not yet injected — ignore
      });
    }
  });

  // ─── Content Script Messages ───

  chrome.runtime.onMessage.addListener(
    (message: ContentToBackgroundMessage, sender, sendResponse) => {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      const url = sender.tab?.url ?? sender.url ?? '';
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        return;
      }

      // Skip blocked origins
      for (const blocked of BLOCKED_ORIGINS) {
        if (origin.startsWith(blocked)) return;
      }

      switch (message.type) {
        case 'TOOL_DISCOVERED': {
          toolRegistry.register(
            tabId,
            message.url,
            message.origin,
            message.tool,
            'unknown',
          );
          break;
        }

        case 'TOOL_REMOVED': {
          const toolId = `${message.origin}::${message.toolName}`;
          toolRegistry.unregister(toolId);
          break;
        }

        case 'PAGE_TOOLS': {
          // If origin has curated definitions, bind them to this tab
          // and skip live-discovered DOM fallback tools
          if (hasCuratedDefinitions(message.origin)) {
            toolRegistry.bindCuratedToTab(message.origin, tabId, message.authState);

            // Still register any native WebMCP tools (higher fidelity than curated)
            const nativeTools = message.tools.filter(t =>
              t.source === 'webmcp-native' || t.source === 'webmcp-declarative'
            );
            for (const tool of nativeTools) {
              toolRegistry.register(tabId, message.url, message.origin, tool, message.authState);
            }
            break;
          }

          // Batch registration: replace all tools for this tab
          const existing = toolRegistry.getByTab(tabId);
          const newNames = new Set(message.tools.map(t => t.name));

          // Remove tools no longer on the page
          for (const tool of existing) {
            if (tool.origin === message.origin && !newNames.has(tool.name)) {
              toolRegistry.unregister(tool.id);
            }
          }

          // Register/update all discovered tools
          for (const tool of message.tools) {
            toolRegistry.register(tabId, message.url, message.origin, tool, message.authState);
          }
          break;
        }

        case 'AUTH_STATE_CHANGED': {
          toolRegistry.updateAuthState(message.origin, message.authState);
          break;
        }
      }

      sendResponse({ ok: true });
      return true;
    }
  );

  // ─── Persistence (survive service worker restarts) ───

  // Save registry to storage periodically
  const SAVE_INTERVAL = 30_000;
  setInterval(async () => {
    if (toolRegistry.size > 0) {
      await chrome.storage.local.set({ toolRegistry: toolRegistry.serialize() });
    }
  }, SAVE_INTERVAL);

  // Restore on startup
  chrome.storage.local.get('toolRegistry').then(({ toolRegistry: saved }) => {
    if (saved) {
      toolRegistry.restore(saved as string);
    }
  });

  console.log('[SessionManager] Started');
}
