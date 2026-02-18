/**
 * Curated tool definitions for Stripe Dashboard (dashboard.stripe.com)
 */
import type { CuratedToolSet } from '../index';

export const stripeTools: CuratedToolSet = {
    origin: 'https://dashboard.stripe.com',
    siteName: 'Stripe',
    definitionVersion: '1.0.0',
    lastVerified: '2026-02-18',
    tools: [
        {
            name: 'stripe_search',
            description: 'Search payments, customers, invoices, subscriptions, and other objects in the Stripe Dashboard.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query. Can be a customer email, payment ID (pi_...), invoice number, or free text.',
                    },
                },
                required: ['query'],
            },
            selector: '[data-testid="search-input"], input[placeholder*="Search"], .SearchInput input',
            executionType: 'search',
        },
        {
            name: 'stripe_create_payment',
            description: 'Navigate to create a new payment link or invoice in Stripe Dashboard',
            inputSchema: {
                type: 'object',
                properties: {},
                required: [],
            },
            selector: 'a[href*="/payment-links/create"], a[href*="/invoices/create"]',
            executionType: 'click',
        },
    ],
};
