/**
 * Curated tool definitions for Gmail (mail.google.com)
 */
import type { CuratedToolSet } from '../index';

export const gmailTools: CuratedToolSet = {
    origin: 'https://mail.google.com',
    siteName: 'Gmail',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'gmail_search',
            description: 'Search emails in Gmail and return visible results. Supports Gmail search operators (from:, to:, subject:, has:attachment, is:unread). Returns email metadata (subject, sender, date) extracted from the page.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports Gmail operators like from:user@example.com, subject:meeting, is:unread, has:attachment, after:2024/01/01',
                    },
                },
                required: ['query'],
            },
            selector: 'input[aria-label="Search mail"], input[name="q"]',
            executionType: 'search',
        },
        {
            name: 'gmail_compose',
            description: 'Open the compose window to write a new email in Gmail',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '[gh="cm"], .T-I.T-I-KE.L3',
            executionType: 'click',
        },
    ],
};
