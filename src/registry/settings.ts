/**
 * Registry Settings — User preferences for community contribution.
 *
 * All settings stored in chrome.storage.sync for cross-device consistency.
 * Contribution is OFF by default — explicit opt-in required.
 */

export interface RegistrySettings {
    /** Whether user has opted in to contributing tool schemas */
    contributeEnabled: boolean;
    /** Whether to use community-verified tools when available */
    useCommunityTools: boolean;
    /** Whether to report execution success/failure for validation */
    reportExecutions: boolean;
    /** When settings were last changed */
    settingsUpdatedAt: string;
}

const DEFAULTS: RegistrySettings = {
    contributeEnabled: false,     // OFF — explicit opt-in
    useCommunityTools: true,      // ON — use community tools by default
    reportExecutions: false,      // OFF — tied to contributeEnabled
    settingsUpdatedAt: '',
};

const STORAGE_KEY = 'registry_settings';

/**
 * Load registry settings from chrome.storage.sync.
 */
export async function getRegistrySettings(): Promise<RegistrySettings> {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return { ...DEFAULTS, ...(result[STORAGE_KEY] ?? {}) };
}

/**
 * Save registry settings to chrome.storage.sync.
 */
export async function saveRegistrySettings(
    settings: Partial<RegistrySettings>,
): Promise<RegistrySettings> {
    const current = await getRegistrySettings();
    const updated: RegistrySettings = {
        ...current,
        ...settings,
        settingsUpdatedAt: new Date().toISOString(),
    };

    await chrome.storage.sync.set({ [STORAGE_KEY]: updated });
    return updated;
}
