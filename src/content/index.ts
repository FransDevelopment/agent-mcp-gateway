/**
 * Content Script Entry Point
 *
 * Injected into every page. Discovers tools and handles execution requests.
 */

import { discoverPageTools, watchForNewTools } from './detector';
import { startExecutor } from './executor';
import { startObserver } from './observer';

// Start the tool execution listener
startExecutor();

// Discover tools on the current page
discoverPageTools();

// Watch for dynamically registered WebMCP tools (Imperative API)
watchForNewTools();

// Watch for dynamically added forms (SPA support)
startObserver();

// Re-discover when the service worker requests it (e.g., after page navigation)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'DISCOVER_TOOLS') {
    discoverPageTools().then(() => sendResponse({ ok: true }));
    return true;
  }
});
