// Import storage from WXT's auto-imports
// In lib files, we need to use #imports or wxt/browser
import { storage } from '#imports';

/**
 * Storage item for module states
 * Uses WXT's storage API with defineItem for type safety and better API
 */
export const moduleStates = storage.defineItem<Record<string, boolean>>(
    'local:sdc-boost-module-states',
    {
        fallback: {},
    }
);

/**
 * Get the enabled state of a module
 * Defaults to enabled (true) if not configured
 */
export async function getModuleState(moduleId: string): Promise<boolean> {
    try {
        const states = await moduleStates.getValue();
        // Default to enabled for modules that haven't been configured yet
        return states[moduleId] !== false;
    } catch (error) {
        console.error('SDC Boost: Error getting module state', error);
        return true; // Default to enabled
    }
}

/**
 * Set the enabled state of a module
 */
export async function setModuleState(moduleId: string, enabled: boolean): Promise<void> {
    try {
        const states = await moduleStates.getValue();
        states[moduleId] = enabled;
        await moduleStates.setValue(states);
    } catch (error) {
        console.error('SDC Boost: Error setting module state', error);
    }
}

/**
 * Get all module states
 */
export async function getAllModuleStates(): Promise<Record<string, boolean>> {
    try {
        return await moduleStates.getValue();
    } catch (error) {
        console.error('SDC Boost: Error getting all module states', error);
        return {};
    }
}

/**
 * Storage item for module configurations
 */
export const moduleConfigs = storage.defineItem<Record<string, Record<string, any>>>(
    'local:sdc-boost-module-configs',
    {
        fallback: {},
    }
);

/**
 * Get the configuration for a module
 */
export async function getModuleConfig(moduleId: string): Promise<Record<string, any>> {
    try {
        const configs = await moduleConfigs.getValue();
        return configs[moduleId] || {};
    } catch (error) {
        console.error('SDC Boost: Error getting module config', error);
        return {};
    }
}

/**
 * Set the configuration for a module
 */
export async function setModuleConfig(moduleId: string, config: Record<string, any>): Promise<void> {
    try {
        const configs = await moduleConfigs.getValue();
        configs[moduleId] = config;
        await moduleConfigs.setValue(configs);
    } catch (error) {
        console.error('SDC Boost: Error setting module config', error);
    }
}

/**
 * Global settings interface
 */
export interface GlobalSettings {
    aiApiKey?: string;
    showCategoryIcons?: boolean;
    filterByActive?: boolean;
}

/**
 * Storage item for global settings
 */
export const globalSettings = storage.defineItem<GlobalSettings>(
    'local:sdc-boost-global-settings',
    {
        fallback: {},
    }
);

/**
 * Get all global settings
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
    try {
        return await globalSettings.getValue();
    } catch (error) {
        console.error('SDC Boost: Error getting global settings', error);
        return {};
    }
}

/**
 * Set global settings
 */
export async function setGlobalSettings(settings: GlobalSettings): Promise<void> {
    try {
        await globalSettings.setValue(settings);
    } catch (error) {
        console.error('SDC Boost: Error setting global settings', error);
    }
}

/**
 * Get AI API key
 */
export async function getAIApiKey(): Promise<string | undefined> {
    try {
        const settings = await globalSettings.getValue();
        return settings.aiApiKey;
    } catch (error) {
        console.error('SDC Boost: Error getting AI API key', error);
        return undefined;
    }
}

/**
 * Set AI API key
 */
export async function setAIApiKey(apiKey: string): Promise<void> {
    try {
        const settings = await globalSettings.getValue();
        settings.aiApiKey = apiKey;
        await globalSettings.setValue(settings);
    } catch (error) {
        console.error('SDC Boost: Error setting AI API key', error);
    }
}

/**
 * Get show category icons setting
 */
export async function getShowCategoryIcons(): Promise<boolean> {
    try {
        const settings = await globalSettings.getValue();
        return settings.showCategoryIcons !== false; // Default to true
    } catch (error) {
        console.error('SDC Boost: Error getting show category icons setting', error);
        return true;
    }
}

/**
 * Set show category icons setting
 */
export async function setShowCategoryIcons(show: boolean): Promise<void> {
    try {
        const settings = await globalSettings.getValue();
        settings.showCategoryIcons = show;
        await globalSettings.setValue(settings);
    } catch (error) {
        console.error('SDC Boost: Error setting show category icons setting', error);
    }
}

/**
 * Get filter by active setting
 */
export async function getFilterByActive(): Promise<boolean> {
    try {
        const settings = await globalSettings.getValue();
        return settings.filterByActive === true; // Default to false
    } catch (error) {
        console.error('SDC Boost: Error getting filter by active setting', error);
        return false;
    }
}

/**
 * Set filter by active setting
 */
export async function setFilterByActive(filter: boolean): Promise<void> {
    try {
        const settings = await globalSettings.getValue();
        settings.filterByActive = filter;
        await globalSettings.setValue(settings);
    } catch (error) {
        console.error('SDC Boost: Error setting filter by active setting', error);
    }
}

/**
 * Storage item for gallery passwords
 * Key format: `${galleryId}_${dbId}`
 */
export const galleryPasswords = storage.defineItem<Record<string, string>>(
    'local:sdc-boost-gallery-passwords',
    {
        fallback: {},
    }
);

/**
 * Get stored password for a gallery
 */
export async function getGalleryPassword(galleryId: string, dbId: string): Promise<string | null> {
    try {
        const passwords = await galleryPasswords.getValue();
        const key = `${galleryId}_${dbId}`;
        return passwords[key] || null;
    } catch (error) {
        console.error('SDC Boost: Error getting gallery password', error);
        return null;
    }
}

/**
 * Set password for a gallery
 */
export async function setGalleryPassword(galleryId: string, dbId: string, password: string): Promise<void> {
    try {
        const passwords = await galleryPasswords.getValue();
        const key = `${galleryId}_${dbId}`;
        passwords[key] = password;
        await galleryPasswords.setValue(passwords);
    } catch (error) {
        console.error('SDC Boost: Error setting gallery password', error);
    }
}

/**
 * Clear password for a gallery
 */
export async function clearGalleryPassword(galleryId: string, dbId: string): Promise<void> {
    try {
        const passwords = await galleryPasswords.getValue();
        const key = `${galleryId}_${dbId}`;
        delete passwords[key];
        await galleryPasswords.setValue(passwords);
    } catch (error) {
        console.error('SDC Boost: Error clearing gallery password', error);
    }
}

