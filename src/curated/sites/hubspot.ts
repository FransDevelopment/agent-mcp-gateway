/**
 * Curated tool definitions for HubSpot (app.hubspot.com)
 */
import type { CuratedToolSet } from '../index';

export const hubspotTools: CuratedToolSet = {
    origin: 'https://app.hubspot.com',
    siteName: 'HubSpot',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'hubspot_search',
            description: 'Search contacts, companies, deals, and tickets across HubSpot CRM',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query — name, email, company, deal name, or ticket number',
                    },
                },
                required: ['query'],
            },
            selector: 'input[data-test-id="search-input"], input[data-selenium="search-input"], [data-test-id="global-search-input"]',
            executionType: 'search',
        },
        {
            name: 'hubspot_create_contact',
            description: 'Open the create contact dialog in HubSpot CRM',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '[data-test-id="create-button"], button[data-selenium="create-record-button"]',
            executionType: 'click',
        },
    ],
};
