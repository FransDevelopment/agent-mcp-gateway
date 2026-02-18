/**
 * Curated tool definitions for Linear (linear.app)
 */
import type { CuratedToolSet } from '../index';

export const linearTools: CuratedToolSet = {
    origin: 'https://linear.app',
    siteName: 'Linear',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'linear_search',
            description: 'Search issues, projects, and documents in Linear. Supports filter syntax.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Can include issue identifiers (e.g. ENG-123) or free text.',
                    },
                },
                required: ['query'],
            },
            selector: '[cmdk-input], [placeholder*="Search"], input[data-testid="search-input"]',
            executionType: 'search',
        },
        {
            name: 'linear_create_issue',
            description: 'Open the new issue creation dialog in Linear',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '[data-testid="create-issue-button"], button[aria-label*="Create issue"]',
            executionType: 'click',
        },
    ],
};
