/**
 * Curated Tool Bundle — Verified tool definitions for popular websites.
 *
 * These ship with the extension, providing instant high-quality tools
 * without requiring live DOM scanning for common sites.
 *
 * Each site file exports a CuratedToolSet with:
 * - Origin pattern matching
 * - Schema-verified tool definitions
 * - CSS selectors confirmed against production
 */

import type { JSONSchema } from '../shared/types';

// ─── Types ───

export interface CuratedToolSet {
    /** Origin this definition applies to, e.g. "https://mail.google.com" */
    origin: string;
    /** Human-readable site name */
    siteName: string;
    /** Version string for staleness tracking */
    definitionVersion: string;
    /** ISO date when definitions were last verified */
    lastVerified: string;
    tools: CuratedTool[];
}

export interface CuratedTool {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    /**
     * CSS selector for the primary interactive element.
     * Used to verify the tool still exists on the page,
     * and as the execution target for DOM interaction.
     */
    selector: string;
    /**
     * Execution type — how to interact with this element.
     * 'form' = fill inputs and submit
     * 'search' = type into search input and press Enter
     * 'click' = click a button/link
     */
    executionType: 'form' | 'search' | 'click';
}

// ─── Site Definitions ───

import { gmailTools } from './sites/gmail';
import { notionTools } from './sites/notion';
import { linearTools } from './sites/linear';
import { githubTools } from './sites/github';
import { stripeTools } from './sites/stripe';

const ALL_CURATED: CuratedToolSet[] = [
    gmailTools,
    notionTools,
    linearTools,
    githubTools,
    stripeTools,
];

/**
 * Get all curated tool definitions.
 */
export function loadCuratedDefinitions(): CuratedToolSet[] {
    return ALL_CURATED;
}

/**
 * Find curated tools for a specific origin.
 */
export function getCuratedForOrigin(origin: string): CuratedToolSet | undefined {
    return ALL_CURATED.find(set => set.origin === origin);
}

/**
 * Check if an origin has curated definitions.
 */
export function hasCuratedDefinitions(origin: string): boolean {
    return ALL_CURATED.some(set => set.origin === origin);
}
