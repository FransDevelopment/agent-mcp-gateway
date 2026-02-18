/**
 * Registry API Client
 *
 * Extension-side client for the shared tool definition registry.
 * All calls run in the service worker context (MV3 fetch restrictions).
 */

import type { JSONSchema } from '../shared/types';
import { REGISTRY_API_BASE, REGISTRY_MIN_SUCCESS_RATE, REGISTRY_MIN_CONTRIBUTORS } from '../shared/constants';
import type { SanitizedTool } from './sanitizer';

// ─── Types ───

export interface RegistryTool {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    status: 'pending' | 'verified' | 'stale';
    successRate: number;
    contributorCount: number;
    updatedAt: string;
}

// ─── Contributor Identity ───

let _contributorId: string | null = null;

/**
 * Get an anonymized contributor identity.
 * SHA-256 of the extension ID + a stable install-time salt.
 * Not traceable to any individual user.
 */
export async function getContributorId(): Promise<string> {
    if (_contributorId) return _contributorId;

    const result = await chrome.storage.local.get('contributor_salt');
    let salt = result.contributor_salt;
    if (!salt) {
        salt = crypto.randomUUID();
        await chrome.storage.local.set({ contributor_salt: salt });
    }

    const raw = `${chrome.runtime.id}:${salt}`;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    _contributorId = Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return _contributorId;
}

// ─── API Calls ───

/**
 * Fetch community-verified tools for an origin.
 * Only returns tools that pass quality thresholds.
 */
export async function fetchRegistryTools(origin: string): Promise<RegistryTool[]> {
    try {
        const url = `${REGISTRY_API_BASE}/registry-tools?origin=${encodeURIComponent(origin)}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            console.warn(`[Registry] Fetch failed for ${origin}: ${res.status}`);
            return [];
        }

        const data = await res.json();
        const tools: RegistryTool[] = data.tools ?? [];

        // Filter by quality thresholds
        return tools.filter(t =>
            t.status === 'verified' &&
            t.successRate >= REGISTRY_MIN_SUCCESS_RATE &&
            t.contributorCount >= REGISTRY_MIN_CONTRIBUTORS
        );
    } catch (err) {
        console.warn('[Registry] Fetch error:', err);
        return [];
    }
}

/**
 * Bulk-fetch community tools for multiple origins.
 * More efficient than individual calls during startup.
 */
export async function fetchRegistryToolsBulk(origins: string[]): Promise<Map<string, RegistryTool[]>> {
    const result = new Map<string, RegistryTool[]>();
    if (origins.length === 0) return result;

    try {
        const csv = origins.map(o => encodeURIComponent(o)).join(',');
        const url = `${REGISTRY_API_BASE}/registry-tools?origins=${csv}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) return result;

        const data = await res.json();
        const tools: (RegistryTool & { origin?: string })[] = data.tools ?? [];

        // Group by origin
        for (const tool of tools) {
            // Note: the API response may need to include origin — to be confirmed
            // For now, tools are fetched per-origin
        }
    } catch (err) {
        console.warn('[Registry] Bulk fetch error:', err);
    }

    return result;
}

/**
 * Contribute a sanitized tool definition to the shared registry.
 */
export async function contributeToolDefinition(tool: SanitizedTool): Promise<boolean> {
    try {
        const url = `${REGISTRY_API_BASE}/registry-tools`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tool),
        });

        if (res.status === 429) {
            console.warn('[Registry] Contribution rate limited');
            return false;
        }

        if (!res.ok) {
            console.warn(`[Registry] Contribution failed: ${res.status}`);
            return false;
        }

        return true;
    } catch (err) {
        console.warn('[Registry] Contribution error:', err);
        return false;
    }
}

/**
 * Report a tool execution result for community validation.
 */
export async function reportExecution(
    origin: string,
    toolName: string,
    success: boolean,
): Promise<void> {
    try {
        const reporterId = await getContributorId();
        const url = `${REGISTRY_API_BASE}/registry-report`;

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, toolName, success, reporterId }),
        });
    } catch {
        // Best-effort — don't block tool execution on reporting
    }
}
