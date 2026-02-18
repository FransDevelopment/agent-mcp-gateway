/**
 * API Response Interceptor — captures site API responses during tool execution.
 *
 * How it works:
 *   1. Before triggering a tool action, the executor calls interceptOnce() with a spec
 *   2. A <script> tag is injected into the page to monkey-patch fetch/XHR
 *   3. When a response matching urlPattern arrives, it's captured and sent via postMessage
 *   4. The content script receives the data and returns it as the tool result
 *   5. Hooks are automatically removed after capture or timeout
 *
 * Privacy: hooks are ONLY active during tool execution. No passive monitoring.
 */

export interface InterceptSpec {
    /** URL pattern to match (string for includes, RegExp for pattern match) */
    urlPattern: string | RegExp;
    /** HTTP method to match (optional, defaults to any) */
    method?: 'GET' | 'POST';
    /** Function that extracts structured data from the raw API response */
    extractFields?: Record<string, string>;
    /** Max wait time in ms (then return empty) */
    timeout: number;
}

export interface InterceptResult {
    success: boolean;
    data: Record<string, unknown>[];
    rawText?: string;
    matchedUrl?: string;
}

/** Unique message channel to avoid conflicts with other extensions/scripts */
const CHANNEL = '__arcede_intercept__';

/**
 * Install a one-shot API intercept — captures the next matching response.
 *
 * The interceptor self-removes after first capture or timeout.
 * This function returns a Promise that resolves with the captured data.
 */
export function interceptOnce(spec: InterceptSpec): Promise<InterceptResult> {
    return new Promise((resolve) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Set up listener in content script to receive data from injected page script
        const handler = (event: MessageEvent) => {
            if (
                event.source !== window ||
                event.data?.channel !== CHANNEL ||
                event.data?.requestId !== requestId
            ) return;

            window.removeEventListener('message', handler);
            clearTimeout(timer);
            cleanupScript(requestId);

            const { responseData, matchedUrl } = event.data;
            try {
                const parsed = typeof responseData === 'string'
                    ? JSON.parse(responseData)
                    : responseData;

                const extracted = extractFromResponse(parsed, spec.extractFields);
                resolve({
                    success: true,
                    data: extracted,
                    rawText: typeof responseData === 'string' ? responseData.slice(0, 2000) : undefined,
                    matchedUrl,
                });
            } catch {
                resolve({
                    success: true,
                    data: [],
                    rawText: typeof responseData === 'string' ? responseData.slice(0, 2000) : responseData,
                    matchedUrl,
                });
            }
        };

        window.addEventListener('message', handler);

        // Timeout — resolve with empty result if no match found
        const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            cleanupScript(requestId);
            resolve({ success: false, data: [] });
        }, spec.timeout);

        // Inject the interceptor script into the page context
        injectInterceptorScript(requestId, spec);
    });
}

/**
 * Inject a <script> tag into the page to monkey-patch fetch/XHR.
 *
 * Content scripts run in an isolated world and can't intercept
 * page-context network requests directly. We inject a script that
 * runs in the page context and communicates back via postMessage.
 */
function injectInterceptorScript(requestId: string, spec: InterceptSpec): void {
    const urlPattern = spec.urlPattern instanceof RegExp
        ? spec.urlPattern.source
        : spec.urlPattern;
    const isRegex = spec.urlPattern instanceof RegExp;
    const method = spec.method ?? 'ANY';

    const scriptContent = `
(function() {
  const CHANNEL = '${CHANNEL}';
  const REQUEST_ID = '${requestId}';
  const URL_PATTERN = ${isRegex ? `new RegExp('${urlPattern}')` : `'${urlPattern}'`};
  const IS_REGEX = ${isRegex};
  const METHOD = '${method}';

  function matchesUrl(url) {
    if (IS_REGEX) return URL_PATTERN.test(url);
    return url.includes(URL_PATTERN);
  }

  function matchesMethod(requestMethod) {
    if (METHOD === 'ANY') return true;
    return requestMethod.toUpperCase() === METHOD;
  }

  let captured = false;

  function sendResult(responseData, matchedUrl) {
    if (captured) return;
    captured = true;
    window.postMessage({
      channel: CHANNEL,
      requestId: REQUEST_ID,
      responseData: responseData,
      matchedUrl: matchedUrl,
    }, '*');
    restore();
  }

  // ── Patch fetch ──
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : (request?.url ?? '');
    const fetchMethod = args[1]?.method ?? 'GET';

    if (!captured && matchesUrl(url) && matchesMethod(fetchMethod)) {
      return originalFetch.apply(this, args).then(async (response) => {
        try {
          const clone = response.clone();
          const text = await clone.text();
          sendResult(text, url);
        } catch {}
        return response;
      });
    }
    return originalFetch.apply(this, args);
  };

  // ── Patch XMLHttpRequest ──
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__arcede_url = url;
    this.__arcede_method = method;
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (!captured && this.__arcede_url && matchesUrl(this.__arcede_url) && matchesMethod(this.__arcede_method)) {
      this.addEventListener('load', function() {
        try {
          sendResult(this.responseText, this.__arcede_url);
        } catch {}
      }, { once: true });
    }
    return originalXHRSend.apply(this, args);
  };

  // ── Restore originals ──
  function restore() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
  }

  // Self-cleanup reference for the content script
  window['__arcede_cleanup_' + REQUEST_ID] = restore;
})();
`;

    const script = document.createElement('script');
    script.id = `arcede-intercept-${requestId}`;
    script.textContent = scriptContent;
    (document.head || document.documentElement).appendChild(script);
    // Remove the script tag immediately (the code already ran)
    script.remove();
}

/**
 * Clean up the interceptor by calling the restore function.
 */
function cleanupScript(requestId: string): void {
    try {
        // Call the cleanup function in the page context
        const cleanupScript = document.createElement('script');
        cleanupScript.textContent = `
      if (window['__arcede_cleanup_${requestId}']) {
        window['__arcede_cleanup_${requestId}']();
        delete window['__arcede_cleanup_${requestId}'];
      }
    `;
        (document.head || document.documentElement).appendChild(cleanupScript);
        cleanupScript.remove();
    } catch {
        // Best effort
    }
}

/**
 * Extract structured data from a parsed API response using field mappings.
 *
 * extractFields maps output field names to simple dot-path accessors.
 * Example: { subject: 'messages[*].subject' }
 *
 * If no extractFields provided, returns the raw parsed response wrapped in an array.
 */
function extractFromResponse(
    parsed: unknown,
    extractFields?: Record<string, string>,
): Record<string, unknown>[] {
    if (!extractFields || Object.keys(extractFields).length === 0) {
        // No field mapping — return raw response as a single item
        if (Array.isArray(parsed)) {
            return parsed.map(item => (typeof item === 'object' && item !== null) ? item as Record<string, unknown> : { value: item });
        }
        return typeof parsed === 'object' && parsed !== null
            ? [parsed as Record<string, unknown>]
            : [{ value: parsed }];
    }

    // Find the array root from the first field mapping
    const firstPath = Object.values(extractFields)[0];
    const arrayMatch = firstPath.match(/^(.+?)\[\*\]/);

    if (!arrayMatch) {
        // No array path — extract from a single object
        const result: Record<string, unknown> = {};
        for (const [outputKey, path] of Object.entries(extractFields)) {
            result[outputKey] = getNestedValue(parsed, path);
        }
        return [result];
    }

    // Get the array from the response
    const arrayPath = arrayMatch[1];
    const items = getNestedValue(parsed, arrayPath);
    if (!Array.isArray(items)) return [];

    return items.map((item: unknown) => {
        const result: Record<string, unknown> = {};
        for (const [outputKey, fullPath] of Object.entries(extractFields)) {
            // Strip the array prefix: 'messages[*].subject' → 'subject'
            const fieldPath = fullPath.replace(/^.+?\[\*\]\.?/, '');
            result[outputKey] = fieldPath ? getNestedValue(item, fieldPath) : item;
        }
        return result;
    });
}

/**
 * Get a nested value from an object using dot notation.
 * Example: getNestedValue(obj, 'a.b.c') → obj.a.b.c
 */
function getNestedValue(obj: unknown, path: string): unknown {
    let current = obj;
    for (const key of path.split('.')) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}
