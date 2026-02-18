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
    /**
     * Optional API interception config — captures the site's own API
     * response after the action to return structured data.
     * If omitted, falls back to accessible text extraction.
     */
    interception?: InterceptionConfig;
}

export interface InterceptionConfig {
    /** URL pattern to match against the site's API calls (string = includes, regex source) */
    urlPattern: string;
    /** Whether urlPattern should be treated as a regex */
    isRegex?: boolean;
    /** HTTP method to match (optional) */
    method?: 'GET' | 'POST';
    /** Field mappings: outputFieldName → jsonPath in the API response */
    extractFields: Record<string, string>;
    /** Max time to wait for the API response (ms) */
    waitMs: number;
}

// ─── Site Definitions ───

import { gmailTools } from './sites/gmail';
import { notionTools } from './sites/notion';
import { linearTools } from './sites/linear';
import { githubTools } from './sites/github';
import { stripeTools } from './sites/stripe';
import { slackTools } from './sites/slack';
import { youtubeTools } from './sites/youtube';
import { googleDriveTools } from './sites/google-drive';
import { googleCalendarTools } from './sites/google-calendar';
import { twitterTools } from './sites/twitter';
import { redditTools } from './sites/reddit';
import { jiraTools } from './sites/jira';
import { hubspotTools } from './sites/hubspot';
import { figmaTools } from './sites/figma';
import { trelloTools } from './sites/trello';
import { vercelTools } from './sites/vercel';

const ALL_CURATED: CuratedToolSet[] = [
    gmailTools,
    notionTools,
    linearTools,
    githubTools,
    stripeTools,
    slackTools,
    youtubeTools,
    googleDriveTools,
    googleCalendarTools,
    twitterTools,
    redditTools,
    jiraTools,
    hubspotTools,
    figmaTools,
    trelloTools,
    vercelTools,
];

/**
 * Get all curated tool definitions.
 */
export function loadCuratedDefinitions(): CuratedToolSet[] {
    return ALL_CURATED;
}

/**
 * Find curated tools for a specific origin.
 * Supports exact match and subdomain matching (e.g. *.atlassian.net).
 */
export function getCuratedForOrigin(origin: string): CuratedToolSet | undefined {
    return ALL_CURATED.find(set => {
        if (set.origin === origin) return true;
        // Subdomain match: e.g. "https://myteam.atlassian.net" matches "https://atlassian.net"
        try {
            const curatedHost = new URL(set.origin).hostname;
            const originHost = new URL(origin).hostname;
            return originHost.endsWith(`.${curatedHost}`);
        } catch {
            return false;
        }
    });
}

/**
 * Check if an origin has curated definitions.
 */
export function hasCuratedDefinitions(origin: string): boolean {
    return getCuratedForOrigin(origin) !== undefined;
}

