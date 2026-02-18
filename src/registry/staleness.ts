/**
 * Registry Staleness Check
 *
 * Validates whether a community-registry tool meets quality thresholds
 * before the extension uses it for MCP clients.
 */

import type { RegistryTool } from './client';
import { REGISTRY_MIN_SUCCESS_RATE, REGISTRY_MIN_CONTRIBUTORS } from '../shared/constants';

/**
 * Check if a community-registry tool is usable.
 * Tools must be verified with sufficient success rate and contributor count.
 */
export function isRegistryToolUsable(tool: RegistryTool): boolean {
    // Only verified tools
    if (tool.status !== 'verified') return false;

    // Minimum success rate
    if (tool.successRate < REGISTRY_MIN_SUCCESS_RATE) return false;

    // Minimum contributor threshold
    if (tool.contributorCount < REGISTRY_MIN_CONTRIBUTORS) return false;

    return true;
}

/**
 * Check if a cached registry response is still fresh.
 * Registry data is cached locally for 24 hours.
 */
export function isRegistryCacheFresh(cachedAt: number, maxAgeMs: number): boolean {
    return Date.now() - cachedAt < maxAgeMs;
}
