/**
 * Curated tool definitions for Trello (trello.com)
 */
import type { CuratedToolSet } from '../index';

export const trelloTools: CuratedToolSet = {
    origin: 'https://trello.com',
    siteName: 'Trello',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'trello_search',
            description: 'Search cards, boards, and members in Trello. Supports Trello search operators (@member, #label, board:, list:, is:, has:, etc.)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports operators like @me, #label, board:name, list:name, is:open, has:attachment, due:week',
                    },
                },
                required: ['query'],
            },
            selector: 'input[data-testid="header-search-input"], input[placeholder*="Search"]',
            executionType: 'search',
        },
        {
            name: 'trello_create_board',
            description: 'Open the create board dialog in Trello',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'button[data-testid="header-create-menu-button"]',
            executionType: 'click',
        },
    ],
};
