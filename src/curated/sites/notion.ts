/**
 * Curated tool definitions for Notion (www.notion.so)
 */
import type { CuratedToolSet } from '../index';

export const notionTools: CuratedToolSet = {
    origin: 'https://www.notion.so',
    siteName: 'Notion',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'notion_search',
            description: 'Search pages, databases, and content in Notion workspace. Returns matching pages and blocks.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query to find pages, databases, or content within the workspace',
                    },
                },
                required: ['query'],
            },
            selector: '.notion-search-input input, [placeholder*="Search"]',
            executionType: 'search',
        },
        {
            name: 'notion_quick_find',
            description: 'Open Notion Quick Find (search modal) to navigate to any page or database',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '.notion-topbar [role="button"]:first-child, .notion-search-button',
            executionType: 'click',
        },
    ],
};
