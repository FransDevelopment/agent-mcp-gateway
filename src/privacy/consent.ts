/**
 * Consent Manager — per-origin user approval for data extraction.
 *
 * When a tool call would extract data from a site for the first time,
 * the user is asked to approve. Consent is stored per origin+level
 * and is revocable anytime from the popup.
 */

import type { PrivacyLevel } from './privacy';

interface ConsentRecord {
    origin: string;
    level: PrivacyLevel;
    grantedAt: number;
    agentClient: string;
}

const STORAGE_KEY = 'originConsent';

/**
 * Check if the user has already consented to data extraction at the
 * given level for a specific origin.
 */
export async function hasConsent(
    origin: string,
    level: PrivacyLevel,
): Promise<boolean> {
    const consents = await loadConsents();
    return consents.some(
        c => c.origin === origin && privacyLevelIncludes(c.level, level),
    );
}

/**
 * Grant consent for a given origin and privacy level.
 */
export async function grantConsent(
    origin: string,
    level: PrivacyLevel,
    agentClient: string,
): Promise<void> {
    const consents = await loadConsents();

    // Remove existing consent for this origin (replace with new level)
    const filtered = consents.filter(c => c.origin !== origin);
    filtered.push({
        origin,
        level,
        grantedAt: Date.now(),
        agentClient,
    });

    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/**
 * Revoke consent for a specific origin.
 */
export async function revokeConsent(origin: string): Promise<void> {
    const consents = await loadConsents();
    const filtered = consents.filter(c => c.origin !== origin);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/**
 * Get all granted consents (for popup display).
 */
export async function getAllConsents(): Promise<ConsentRecord[]> {
    return loadConsents();
}

/**
 * Revoke all consents.
 */
export async function revokeAllConsents(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

// ─── Helpers ───

async function loadConsents(): Promise<ConsentRecord[]> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return (result[STORAGE_KEY] as ConsentRecord[]) ?? [];
    } catch {
        return [];
    }
}

/**
 * Check if a granted level includes the requested level.
 * 'full' includes 'content' and 'metadata'.
 * 'content' includes 'metadata'.
 */
function privacyLevelIncludes(granted: PrivacyLevel, requested: PrivacyLevel): boolean {
    const hierarchy: Record<PrivacyLevel, number> = {
        metadata: 0,
        content: 1,
        full: 2,
    };
    return hierarchy[granted] >= hierarchy[requested];
}
