/**
 * Curated tool definitions for Vercel (vercel.com)
 */
import type { CuratedToolSet } from '../index';

export const vercelTools: CuratedToolSet = {
    origin: 'https://vercel.com',
    siteName: 'Vercel',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'vercel_search',
            description: 'Search projects, deployments, and domains across Vercel dashboard',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for projects, deployments, or domains',
                    },
                },
                required: ['query'],
            },
            selector: 'input[data-testid="command-menu-input"], [data-testid="search-input"] input',
            executionType: 'search',
        },
        {
            name: 'vercel_new_project',
            description: 'Navigate to import/create a new project on Vercel',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[href="/new"], [data-testid="new-project-button"]',
            executionType: 'click',
        },
    ],
};
