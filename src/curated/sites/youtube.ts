/**
 * Curated tool definitions for YouTube (www.youtube.com)
 */
import type { CuratedToolSet } from '../index';

export const youtubeTools: CuratedToolSet = {
    origin: 'https://www.youtube.com',
    siteName: 'YouTube',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'youtube_search',
            description: 'Search for videos, channels, and playlists on YouTube',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for videos, channels, or playlists',
                    },
                },
                required: ['query'],
            },
            selector: 'input#search, input[name="search_query"]',
            executionType: 'search',
        },
    ],
};
