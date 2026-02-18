/**
 * Accessible Text Extractor — universal fallback for data extraction.
 *
 * Reads the accessibility tree (ARIA roles, semantic HTML) from the page
 * to extract meaningful text content. Works on any site without
 * site-specific configuration.
 *
 * Privacy: Only runs when explicitly triggered by a tool call.
 * Returns visible, user-facing text — nothing hidden or aria-hidden.
 */

export interface A11yExtractionResult {
    /** Text from <main>, role="main", or largest content region */
    mainContent: string;
    /** Page title */
    title: string;
    /** Heading hierarchy (h1-h6) */
    headings: string[];
    /** ARIA landmark regions: role → text */
    landmarks: Record<string, string>;
    /** List items from lists, tables, or role="listbox" */
    listItems: string[];
    /** Truncated to maxLength */
    truncated: boolean;
}

const DEFAULT_MAX_LENGTH = 3000;

/**
 * Extract accessible text from the current page.
 *
 * @param scope Optional CSS selector to scope extraction (e.g., 'main')
 * @param maxLength Maximum total characters to return
 */
export function extractAccessibleContent(
    scope?: string,
    maxLength: number = DEFAULT_MAX_LENGTH,
): A11yExtractionResult {
    const root = scope ? document.querySelector(scope) : findMainContent();
    const result: A11yExtractionResult = {
        mainContent: '',
        title: document.title || '',
        headings: [],
        landmarks: {},
        listItems: [],
        truncated: false,
    };

    if (!root) {
        result.mainContent = extractVisibleText(document.body, maxLength);
        result.truncated = result.mainContent.length >= maxLength;
        return result;
    }

    // Extract headings
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const h of headings) {
        const text = getAccessibleText(h);
        if (text && result.headings.length < 20) {
            result.headings.push(`${h.tagName}: ${text}`);
        }
    }

    // Extract ARIA landmarks
    const landmarkRoles = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'region'];
    for (const role of landmarkRoles) {
        const el = root.querySelector(`[role="${role}"]`) || (role === 'main' ? root.querySelector('main') : null);
        if (el) {
            const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || role;
            result.landmarks[label] = extractVisibleText(el, 500);
        }
    }

    // Extract list items (search results, feeds, etc.)
    const listContainers = root.querySelectorAll(
        '[role="list"], [role="listbox"], [role="feed"], [role="grid"], [role="table"], ul, ol, table, tbody'
    );
    for (const container of listContainers) {
        const items = container.querySelectorAll(
            '[role="listitem"], [role="option"], [role="row"], [role="article"], li, tr'
        );
        for (const item of items) {
            if (result.listItems.length >= 30) break;
            const text = getAccessibleText(item);
            if (text && text.length > 5) {
                result.listItems.push(text);
            }
        }
        if (result.listItems.length >= 30) break;
    }

    // Extract main content text
    result.mainContent = extractVisibleText(root, maxLength);
    result.truncated = result.mainContent.length >= maxLength;

    return result;
}

/**
 * Find the main content region of the page.
 * Priority: <main> → role="main" → largest content block.
 */
function findMainContent(): Element {
    // 1. Semantic <main>
    const main = document.querySelector('main');
    if (main) return main;

    // 2. ARIA role="main"
    const ariaMain = document.querySelector('[role="main"]');
    if (ariaMain) return ariaMain;

    // 3. Common content containers
    const contentSelectors = [
        '#content', '#main-content', '.main-content',
        '[data-testid="primary-column"]', // Twitter
        '.application-main', // GitHub
        'article',
    ];
    for (const sel of contentSelectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }

    // 4. Fallback: body
    return document.body;
}

/**
 * Get the accessible text of an element.
 * Uses aria-label, aria-labelledby, alt text, or visible text content.
 */
function getAccessibleText(el: Element): string {
    // aria-label takes priority
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent?.trim() ?? '';
    }

    // alt text for images
    if (el instanceof HTMLImageElement && el.alt) {
        return el.alt.trim();
    }

    // Visible text content
    return extractVisibleText(el, 500);
}

/**
 * Extract visible text from an element, skipping hidden/aria-hidden content.
 * Normalizes whitespace and truncates to maxLength.
 */
function extractVisibleText(el: Element, maxLength: number): string {
    const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Skip hidden elements
                if (parent.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
                if (parent.hidden) return NodeFilter.FILTER_REJECT;

                const style = getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip script/style content
                const tag = parent.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        },
    );

    const parts: string[] = [];
    let totalLength = 0;
    let node: Node | null;

    while ((node = walker.nextNode()) && totalLength < maxLength) {
        const text = (node.textContent ?? '').trim();
        if (text) {
            parts.push(text);
            totalLength += text.length;
        }
    }

    return parts.join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}
