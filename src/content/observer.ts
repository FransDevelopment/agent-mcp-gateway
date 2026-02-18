/**
 * SPA Observer — Watches for dynamically added forms and interactive elements.
 *
 * SPAs like GitHub, Notion, etc. render content after the initial page load.
 * This module uses MutationObserver to detect new forms/inputs and
 * triggers re-discovery so dynamically rendered tools get picked up.
 */

import { discoverPageTools } from './detector';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Minimum interval between re-discoveries (ms) */
const DEBOUNCE_MS = 500;

/**
 * Start observing the DOM for dynamically added forms and interactive elements.
 * Triggers tool re-discovery when new forms or search inputs appear.
 */
export function startObserver(): void {
    if (observer) return;
    if (!document.body) return;

    observer = new MutationObserver((mutations) => {
        // Only re-scan if new forms or interactive elements were added
        const hasRelevantChanges = mutations.some(mutation =>
            Array.from(mutation.addedNodes).some(node => {
                if (!(node instanceof HTMLElement)) return false;

                // Direct form or input added
                if (node.tagName === 'FORM') return true;

                // Declarative WebMCP form added
                if (node.hasAttribute?.('data-mcp-tool')) return true;

                // Container that might include forms
                if (node.querySelector?.('form, input[type="search"], [role="searchbox"], [data-mcp-tool]')) {
                    return true;
                }

                return false;
            })
        );

        if (hasRelevantChanges) {
            // Debounce to avoid rapid re-scans during SPA transitions
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('[AgentGateway] SPA observer detected new forms, re-discovering tools');
                discoverPageTools();
            }, DEBOUNCE_MS);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    console.log('[AgentGateway] SPA observer started');
}

/**
 * Stop observing the DOM. Useful for cleanup.
 */
export function stopObserver(): void {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}
