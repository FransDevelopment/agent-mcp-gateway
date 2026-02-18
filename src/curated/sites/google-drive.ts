/**
 * Curated tool definitions for Google Drive (drive.google.com)
 */
import type { CuratedToolSet } from '../index';

export const googleDriveTools: CuratedToolSet = {
    origin: 'https://drive.google.com',
    siteName: 'Google Drive',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'google_drive_search',
            description: 'Search files, folders, and documents in Google Drive. Supports Drive search operators (type:, owner:, before:, after:, etc.)',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Supports operators like type:document, type:spreadsheet, owner:me, before:2024-01-01, is:starred',
                    },
                },
                required: ['query'],
            },
            selector: 'input[aria-label="Search in Drive"], input[name="q"]',
            executionType: 'search',
        },
        {
            name: 'google_drive_new',
            description: 'Open the "New" menu to create a new document, spreadsheet, folder, or upload a file in Google Drive',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: '[data-tooltip="New"], button[aria-label="New"]',
            executionType: 'click',
        },
    ],
};
