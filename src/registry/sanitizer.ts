/**
 * Privacy-Safe Schema Sanitizer
 *
 * Strips all user-specific and DOM-structural data from tool definitions
 * before contributing to the shared registry.
 *
 * NEVER transmitted: selectors, URL paths, cookies, default values,
 * or any field that could contain personal data.
 */

import type { RegisteredTool, JSONSchema, JSONSchemaProperty } from '../shared/types';

export interface SanitizedTool {
    origin: string;
    toolName: string;
    description: string;
    inputSchema: JSONSchema;
    contributorId: string;
}

/**
 * Sanitize a registered tool for safe community contribution.
 * Returns null if the tool shouldn't be contributed.
 */
export function sanitizeForContribution(
    tool: RegisteredTool,
    contributorId: string,
): SanitizedTool | null {
    // Only contribute DOM fallback tools — native/declarative/curated are public anyway
    if (tool.source !== 'dom-fallback') return null;

    // Don't contribute tools with login-required state (schema might be a login form)
    if (tool.authState === 'login-required') return null;

    // Deep clone the schema to avoid mutations
    const cleanSchema = sanitizeSchema(structuredClone(tool.inputSchema));

    return {
        origin: tool.origin,    // Origin only — no paths
        toolName: tool.name,
        description: sanitizeDescription(tool.description),
        inputSchema: cleanSchema,
        contributorId,
    };
}

/**
 * Strip potentially sensitive data from a JSON Schema.
 */
function sanitizeSchema(schema: JSONSchema): JSONSchema {
    if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            // Remove defaults (may contain user-specific data like email)
            delete prop.default;

            // Remove enum values if they look like personal data
            if (prop.enum && prop.enum.some(containsPersonalData)) {
                delete prop.enum;
            }

            // Sanitize nested items (arrays)
            if (prop.items) {
                sanitizeProperty(prop.items);
            }
        }
    }

    return schema;
}

/**
 * Sanitize a single property (recursive for nested schemas).
 */
function sanitizeProperty(prop: JSONSchemaProperty): void {
    delete prop.default;
    if (prop.enum && prop.enum.some(containsPersonalData)) {
        delete prop.enum;
    }
    if (prop.items) {
        sanitizeProperty(prop.items);
    }
}

/**
 * Check if a string looks like personal data.
 */
function containsPersonalData(value: string): boolean {
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
    // Phone number pattern
    if (/^\+?\d[\d\s\-()]{7,}$/.test(value)) return true;
    // URL with user info
    if (/https?:\/\/.*@/.test(value)) return true;
    return false;
}

/**
 * Strip any user-specific references from tool descriptions.
 */
function sanitizeDescription(description: string): string {
    // Remove email addresses
    let clean = description.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]');
    // Remove URLs with paths (keep just domain mention)
    clean = clean.replace(/https?:\/\/[^\s]+/g, (url) => {
        try {
            return new URL(url).origin;
        } catch {
            return '[url]';
        }
    });
    return clean;
}
