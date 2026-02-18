/**
 * Curated tool definitions for X / Twitter (x.com)
 */
import type { CuratedToolSet } from '../index';

export const twitterTools: CuratedToolSet = {
    origin: 'https://x.com',
    siteName: 'X (Twitter)',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'twitter_search',
            description: 'Search posts, people, and topics on X (Twitter). Supports X search operators (from:, to:, min_faves:, filter:, etc.)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports operators like from:username, to:username, min_faves:100, filter:links, filter:media, lang:en',
                    },
                },
                required: ['query'],
            },
            selector: 'input[data-testid="SearchBox_Search_Input"], input[aria-label="Search query"]',
            executionType: 'search',
        },
        {
            name: 'twitter_compose',
            description: 'Open the tweet/post compose dialog on X (Twitter)',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[data-testid="SideNav_NewTweet_Button"], a[href="/compose/post"]',
            executionType: 'click',
        },
    ],
};
