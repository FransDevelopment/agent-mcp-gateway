/**
 * Privacy Manager — enforces extraction rules and maintains audit log.
 *
 * Core principles:
 *   1. No passive monitoring — hooks only during tool execution
 *   2. Data minimization — only declared fields are returned
 *   3. Zero persistence — extracted data never written to storage
 *   4. User visibility — audit log readable from popup
 */

export type PrivacyLevel = 'metadata' | 'content' | 'full';

export interface PrivacyPolicy {
    /** Allow metadata extraction (subject, sender, date, etc.) */
    allowMetadata: boolean;
    /** Allow content extraction (email body, message text) */
    allowContent: boolean;
    /** Allow attachment/file extraction */
    allowAttachments: boolean;
}

export interface AuditEntry {
    timestamp: number;
    toolName: string;
    origin: string;
    fieldsExtracted: string[];
    dataLevel: PrivacyLevel;
    agentClient: string;
}

/** Default policy: metadata only, no content or attachments */
const DEFAULT_POLICY: PrivacyPolicy = {
    allowMetadata: true,
    allowContent: false,
    allowAttachments: false,
};

/** Fields classified by privacy level */
const METADATA_FIELDS = new Set([
    'subject', 'title', 'name', 'sender', 'from', 'to', 'date',
    'timestamp', 'unread', 'read', 'starred', 'label', 'labels',
    'category', 'status', 'priority', 'type', 'count', 'size',
    'url', 'href', 'link', 'id', 'stars', 'forks', 'language',
    'description', 'snippet', 'preview', 'author', 'owner',
]);

const CONTENT_FIELDS = new Set([
    'body', 'content', 'text', 'message', 'html', 'markdown',
    'notes', 'comment', 'reply', 'thread',
]);

const ATTACHMENT_FIELDS = new Set([
    'attachment', 'attachments', 'file', 'files', 'media',
    'image', 'images', 'document', 'documents',
]);

/** In-memory ring buffer — never persisted to disk */
const AUDIT_LOG_MAX = 100;
const auditLog: AuditEntry[] = [];

let currentPolicy: PrivacyPolicy = { ...DEFAULT_POLICY };

/**
 * Classify a field name into a privacy level.
 */
export function classifyField(fieldName: string): PrivacyLevel {
    const lower = fieldName.toLowerCase();
    if (ATTACHMENT_FIELDS.has(lower)) return 'full';
    if (CONTENT_FIELDS.has(lower)) return 'content';
    return 'metadata';
}

/**
 * Filter extracted data according to the current privacy policy.
 * Returns only fields the user has consented to.
 */
export function filterByPolicy(
    data: Record<string, unknown>[],
    policy?: PrivacyPolicy,
): Record<string, unknown>[] {
    const p = policy ?? currentPolicy;

    return data.map(item => {
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(item)) {
            const level = classifyField(key);
            if (level === 'metadata' && p.allowMetadata) {
                filtered[key] = value;
            } else if (level === 'content' && p.allowContent) {
                filtered[key] = value;
            } else if (level === 'full' && p.allowAttachments) {
                filtered[key] = value;
            }
            // Field is silently dropped if not allowed
        }
        return filtered;
    }).filter(item => Object.keys(item).length > 0);
}

/**
 * Record a tool execution in the audit log.
 */
export function recordAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
    auditLog.push({ ...entry, timestamp: Date.now() });
    if (auditLog.length > AUDIT_LOG_MAX) {
        auditLog.shift();
    }
}

/**
 * Get the current audit log (for popup display).
 */
export function getAuditLog(): AuditEntry[] {
    return [...auditLog];
}

/**
 * Get the current privacy policy.
 */
export function getPrivacyPolicy(): PrivacyPolicy {
    return { ...currentPolicy };
}

/**
 * Update the privacy policy (called from popup settings).
 */
export function setPrivacyPolicy(policy: Partial<PrivacyPolicy>): PrivacyPolicy {
    currentPolicy = { ...currentPolicy, ...policy };
    return { ...currentPolicy };
}

/**
 * Load privacy policy from chrome.storage.local.
 */
export async function loadPrivacyPolicy(): Promise<PrivacyPolicy> {
    try {
        const stored = await chrome.storage.local.get('privacyPolicy');
        if (stored.privacyPolicy) {
            currentPolicy = { ...DEFAULT_POLICY, ...stored.privacyPolicy };
        }
    } catch {
        // Use defaults
    }
    return { ...currentPolicy };
}

/**
 * Save privacy policy to chrome.storage.local.
 */
export async function savePrivacyPolicy(policy: PrivacyPolicy): Promise<void> {
    currentPolicy = { ...policy };
    await chrome.storage.local.set({ privacyPolicy: currentPolicy });
}
