/**
 * Curated tool definitions for Slack (app.slack.com)
 */
import type { CuratedToolSet } from '../index';

export const slackTools: CuratedToolSet = {
    origin: 'https://app.slack.com',
    siteName: 'Slack',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'slack_search',
            description: 'Search messages, files, and channels in Slack. Supports Slack search modifiers (from:, in:, has:, before:, after:, etc.)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports modifiers like from:@user, in:#channel, has:link, has:reaction, before:2024-01-01',
                    },
                },
                required: ['query'],
            },
            selector: '[data-qa="search_input"], [data-qa="focusable_search_input"], button[data-qa="top_nav_search"]',
            executionType: 'search',
        },
        {
            name: 'slack_new_message',
            description: 'Open the compose/new message dialog in Slack',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'button[data-qa="composer_button"], button[data-qa="new-message-button"]',
            executionType: 'click',
        },
    ],
};
