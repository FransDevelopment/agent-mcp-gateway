/**
 * Curated tool definitions for Google Calendar (calendar.google.com)
 */
import type { CuratedToolSet } from '../index';

export const googleCalendarTools: CuratedToolSet = {
    origin: 'https://calendar.google.com',
    siteName: 'Google Calendar',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'google_calendar_search',
            description: 'Search for events in Google Calendar',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query to find events by title, attendees, or description',
                    },
                },
                required: ['query'],
            },
            selector: 'input[aria-label="Search"], #search-input input',
            executionType: 'search',
        },
        {
            name: 'google_calendar_create_event',
            description: 'Open the event creation dialog in Google Calendar',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '[data-view="0"] [aria-label="Create"], button[aria-label="Create"]',
            executionType: 'click',
        },
    ],
};
