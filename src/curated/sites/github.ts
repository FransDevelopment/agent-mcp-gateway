/**
 * Curated tool definitions for GitHub (github.com)
 */
import type { CuratedToolSet } from '../index';

export const githubTools: CuratedToolSet = {
    origin: 'https://github.com',
    siteName: 'GitHub',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'github_search',
            description: 'Search repositories, code, issues, pull requests, and users across GitHub. Supports GitHub search qualifiers.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports qualifiers like repo:owner/name, language:python, is:issue, is:pr, label:bug, author:username',
                    },
                },
                required: ['query'],
            },
            selector: 'input[name="q"], .header-search-input, [data-target="qbsearch-input.inputButtonText"]',
            executionType: 'search',
        },
        {
            name: 'github_new_repo',
            description: 'Navigate to the new repository creation page on GitHub',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[href="/new"], [data-testid="create-repo-button"]',
            executionType: 'click',
        },
        {
            name: 'github_new_issue',
            description: 'Open the new issue form for the current repository on GitHub. Must be on a repository page.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[href$="/issues/new"], a[href*="/issues/new/choose"]',
            executionType: 'click',
        },
    ],
};
