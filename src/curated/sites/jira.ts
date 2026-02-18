/**
 * Curated tool definitions for Jira (*.atlassian.net)
 */
import type { CuratedToolSet } from '../index';

export const jiraTools: CuratedToolSet = {
    origin: 'https://atlassian.net',
    siteName: 'Jira',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'jira_search',
            description: 'Search issues, projects, boards, and filters in Jira. Supports JQL (Jira Query Language).',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query or JQL. Examples: "login bug", "project = ENG AND status = Open", "assignee = currentUser() AND sprint in openSprints()"',
                    },
                },
                required: ['query'],
            },
            selector: 'input[data-testid="search-dialog-input"], input[aria-label="Search"], [data-testid="atlassian-navigation--search-button"]',
            executionType: 'search',
        },
        {
            name: 'jira_create_issue',
            description: 'Open the create issue dialog in Jira',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'button[data-testid="global-create-button"], a[id="create_link"]',
            executionType: 'click',
        },
    ],
};
