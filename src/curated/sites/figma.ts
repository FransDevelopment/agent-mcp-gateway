/**
 * Curated tool definitions for Figma (www.figma.com)
 */
import type { CuratedToolSet } from '../index';

export const figmaTools: CuratedToolSet = {
    origin: 'https://www.figma.com',
    siteName: 'Figma',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'figma_search',
            description: 'Search files, projects, and teams in Figma',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for files, projects, components, or teams',
                    },
                },
                required: ['query'],
            },
            selector: 'input[placeholder*="Search"], [data-testid="search-input"] input',
            executionType: 'search',
        },
        {
            name: 'figma_new_file',
            description: 'Create a new Figma design file',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'button[data-testid="new-file-button"], [data-tooltip="New design file"]',
            executionType: 'click',
        },
    ],
};
