/**
 * Curated tool definitions for Reddit (www.reddit.com)
 */
import type { CuratedToolSet } from '../index';

export const redditTools: CuratedToolSet = {
    origin: 'https://www.reddit.com',
    siteName: 'Reddit',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'reddit_search',
            description: 'Search posts, subreddits, and comments on Reddit. Supports Reddit search syntax (subreddit:, author:, flair:, etc.)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports syntax like subreddit:programming, author:username, flair:discussion, site:github.com',
                    },
                },
                required: ['query'],
            },
            selector: '#search-input input, input[type="search"][name="q"], faceplate-search-input input',
            executionType: 'search',
        },
        {
            name: 'reddit_create_post',
            description: 'Navigate to the post creation page on Reddit',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[href*="/submit"], [data-testid="create-post"]',
            executionType: 'click',
        },
    ],
};
