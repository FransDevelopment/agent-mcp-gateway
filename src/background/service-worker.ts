/**
 * Arcede Agent Gateway — Background Service Worker
 *
 * Entry point for the Chrome extension's background process.
 * Initializes the tool registry, MCP server, and session manager.
 */

import { startMCPServer, getConnectedClientCount } from './mcp-server';
import { startSessionManager } from './session-manager';
import { toolRegistry } from './tool-registry';
import { loadCuratedDefinitions } from '../curated/index';
import { GATEWAY_NAME, GATEWAY_VERSION, BLOCKED_ORIGINS } from '../shared/constants';
import { fetchRegistryTools, reportExecution, contributeToolDefinition, getContributorId } from '../registry/client';
import { getRegistrySettings, saveRegistrySettings } from '../registry/settings';
import { sanitizeForContribution } from '../registry/sanitizer';

console.log(`[${GATEWAY_NAME}] Service worker starting (v${GATEWAY_VERSION})`);

// Initialize core systems
startSessionManager();
startMCPServer();

// ─── Load Curated Tool Bundle ───

const curatedSets = loadCuratedDefinitions();
for (const set of curatedSets) {
  toolRegistry.registerCurated(set.origin, set.tools);
}
console.log(`[${GATEWAY_NAME}] Loaded curated tools for ${curatedSets.length} sites`);

// ─── Extension Install / Update ───

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log(`[${GATEWAY_NAME}] Extension installed`);
  } else if (details.reason === 'update') {
    console.log(`[${GATEWAY_NAME}] Extension updated to v${GATEWAY_VERSION}`);
  }

  // Re-inject content scripts into all open tabs to re-discover tools
  const tabs = await chrome.tabs.query({});
  let injected = 0;
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Skip restricted pages
    if (Array.from(BLOCKED_ORIGINS).some(blocked => tab.url!.startsWith(blocked))) continue;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js'],
      });
      injected++;
    } catch {
      // Silently fail for restricted pages (chrome://, etc.)
    }
  }
  console.log(`[${GATEWAY_NAME}] Re-injected content scripts into ${injected} tabs`);
});

// ─── Message Handlers ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Popup: get full registry state
  if (message.type === 'GET_REGISTRY_STATE') {
    sendResponse({
      type: 'REGISTRY_STATE',
      tools: toolRegistry.getAll().map(t => ({
        id: t.id,
        name: t.name,
        origin: t.origin,
        source: t.source,
        authState: t.authState,
      })),
      connectedClients: getConnectedClientCount(),
    });
    return true;
  }

  // Content script: fetch community tools for an origin
  if (message.type === 'GET_REGISTRY_TOOLS') {
    (async () => {
      const settings = await getRegistrySettings();
      if (!settings.useCommunityTools) {
        sendResponse({ tools: [] });
        return;
      }
      const tools = await fetchRegistryTools(message.origin);
      sendResponse({ tools });
    })();
    return true;
  }

  // Popup: get registry settings
  if (message.type === 'GET_REGISTRY_SETTINGS') {
    getRegistrySettings().then(settings => sendResponse(settings));
    return true;
  }

  // Popup: save registry settings
  if (message.type === 'SAVE_REGISTRY_SETTINGS') {
    saveRegistrySettings(message.settings).then(settings => sendResponse(settings));
    return true;
  }
});

// ─── Auto-Contribution on Tool Discovery ───
// When new tools are registered and user has opted in, contribute to the registry

toolRegistry.onChange(async () => {
  const settings = await getRegistrySettings();
  if (!settings.contributeEnabled) return;

  const contributorId = await getContributorId();
  const tools = toolRegistry.getAll();

  for (const tool of tools) {
    const sanitized = sanitizeForContribution(tool, contributorId);
    if (sanitized) {
      contributeToolDefinition(sanitized).catch(() => {
        // Best-effort contribution
      });
    }
  }
});

console.log(`[${GATEWAY_NAME}] Service worker ready`);

