/**
 * Service Configuration Manager
 * Controls platform services status (enable/disable), syncs with Supabase
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';

const getWriteClient = () => supabaseAdmin || supabase;
const getReadClient = () => supabase;

export type PlatformId = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo';

export interface PlatformStats { totalRequests: number; successCount: number; errorCount: number; avgResponseTime: number }

export interface PlatformConfig {
    id: PlatformId; name: string; enabled: boolean; method: string;
    rateLimit: number; cacheTime: number; disabledMessage: string;
    lastUpdated: string; stats: PlatformStats;
}

export interface ServiceConfig {
    platforms: Record<PlatformId, PlatformConfig>;
    globalRateLimit: number; playgroundRateLimit: number; playgroundEnabled: boolean;
    maintenanceMode: boolean; maintenanceMessage: string; apiKeyRequired: boolean; lastUpdated: string;
}

const PLATFORM_NAMES: Record<PlatformId, string> = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter/X', tiktok: 'TikTok', weibo: 'Weibo' };

const DEFAULT_CONFIG: ServiceConfig = {
    platforms: {
        facebook: { id: 'facebook', name: 'Facebook', enabled: true, method: 'HTML Scraping', rateLimit: 10, cacheTime: 300, disabledMessage: 'Facebook service is temporarily unavailable.', lastUpdated: new Date().toISOString(), stats: { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 } },
        instagram: { id: 'instagram', name: 'Instagram', enabled: true, method: 'Embed API', rateLimit: 15, cacheTime: 300, disabledMessage: 'Instagram service is temporarily unavailable.', lastUpdated: new Date().toISOString(), stats: { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 } },
        twitter: { id: 'twitter', name: 'Twitter/X', enabled: true, method: 'Syndication API', rateLimit: 20, cacheTime: 300, disabledMessage: 'Twitter/X service is temporarily unavailable.', lastUpdated: new Date().toISOString(), stats: { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 } },
        tiktok: { id: 'tiktok', name: 'TikTok', enabled: true, method: 'TikWM API', rateLimit: 15, cacheTime: 300, disabledMessage: 'TikTok service is temporarily unavailable.', lastUpdated: new Date().toISOString(), stats: { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 } },
        weibo: { id: 'weibo', name: 'Weibo', enabled: true, method: 'Mobile API', rateLimit: 10, cacheTime: 300, disabledMessage: 'Weibo service is temporarily unavailable.', lastUpdated: new Date().toISOString(), stats: { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 } },
    },
    globalRateLimit: 15, playgroundRateLimit: 5, playgroundEnabled: true,
    maintenanceMode: false, maintenanceMessage: '🔧 XTFetch is under maintenance. Please try again later.',
    apiKeyRequired: false, lastUpdated: new Date().toISOString()
};

let serviceConfig: ServiceConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let lastFetch = 0;
const CACHE_TTL = 30000;

export async function loadConfigFromDB(): Promise<boolean> {
    const db = getReadClient();
    if (!db) return false;
    try {
        const { data, error } = await db.from('service_config').select('*');
        if (error || !data) return false;
        for (const row of data) {
            if (row.id === 'global') {
                serviceConfig.maintenanceMode = row.maintenance_mode ?? false;
                serviceConfig.maintenanceMessage = row.maintenance_message ?? DEFAULT_CONFIG.maintenanceMessage;
                serviceConfig.apiKeyRequired = row.api_key_required ?? true;
                serviceConfig.globalRateLimit = row.rate_limit ?? 60;
                serviceConfig.playgroundRateLimit = row.playground_rate_limit ?? 5;
                serviceConfig.playgroundEnabled = row.playground_enabled ?? true;
                serviceConfig.lastUpdated = row.updated_at;
            } else if (row.id in serviceConfig.platforms) {
                const pid = row.id as PlatformId;
                serviceConfig.platforms[pid] = {
                    id: pid, name: PLATFORM_NAMES[pid], enabled: row.enabled ?? true,
                    method: row.method ?? serviceConfig.platforms[pid].method,
                    rateLimit: row.rate_limit ?? 10, cacheTime: row.cache_time ?? 300,
                    disabledMessage: row.disabled_message ?? `${PLATFORM_NAMES[pid]} service is temporarily unavailable.`,
                    lastUpdated: row.updated_at, stats: row.stats ?? { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 }
                };
            }
        }
        lastFetch = Date.now();
        return true;
    } catch { return false; }
}

async function ensureFresh() { if (Date.now() - lastFetch > CACHE_TTL) await loadConfigFromDB(); }

export async function saveGlobalConfig(): Promise<boolean> {
    const db = getWriteClient();
    if (!db) return false;
    try {
        const { error } = await db.from('service_config').upsert({
            id: 'global', enabled: true, rate_limit: serviceConfig.globalRateLimit,
            playground_rate_limit: serviceConfig.playgroundRateLimit, playground_enabled: serviceConfig.playgroundEnabled,
            maintenance_mode: serviceConfig.maintenanceMode, maintenance_message: serviceConfig.maintenanceMessage,
            api_key_required: serviceConfig.apiKeyRequired, updated_at: new Date().toISOString()
        });
        return !error;
    } catch { return false; }
}

export async function savePlatformConfig(platformId: PlatformId): Promise<boolean> {
    const db = getWriteClient();
    if (!db) return false;
    const platform = serviceConfig.platforms[platformId];
    if (!platform) return false;
    try {
        const { error } = await db.from('service_config').upsert({ id: platformId, enabled: platform.enabled, rate_limit: platform.rateLimit, updated_at: new Date().toISOString() });
        return !error;
    } catch { return false; }
}

// Getters
export function getServiceConfig(): ServiceConfig { return { ...serviceConfig }; }
export async function getServiceConfigAsync(): Promise<ServiceConfig> { await ensureFresh(); return { ...serviceConfig }; }
export function getPlatformConfig(platformId: PlatformId): PlatformConfig | null { return serviceConfig.platforms[platformId] || null; }
export function isPlatformEnabled(platformId: PlatformId): boolean { return serviceConfig.platforms[platformId]?.enabled ?? false; }
export function isMaintenanceMode(): boolean { return serviceConfig.maintenanceMode; }
export function getMaintenanceMessage(): string { return serviceConfig.maintenanceMessage; }
export function isApiKeyRequired(): boolean { return serviceConfig.apiKeyRequired; }
export function isPlaygroundEnabled(): boolean { return serviceConfig.playgroundEnabled; }
export function getPlaygroundRateLimit(): number { return serviceConfig.playgroundRateLimit; }
export function getGlobalRateLimit(): number { return serviceConfig.globalRateLimit; }
export function getPlatformDisabledMessage(platformId: PlatformId): string { return serviceConfig.platforms[platformId]?.disabledMessage || `${platformId} service is currently disabled.`; }
export function getAllPlatforms(): PlatformConfig[] { return Object.values(serviceConfig.platforms); }

// Setters
export async function setPlatformEnabled(platformId: PlatformId, enabled: boolean): Promise<boolean> {
    if (!serviceConfig.platforms[platformId]) return false;
    serviceConfig.platforms[platformId].enabled = enabled;
    serviceConfig.platforms[platformId].lastUpdated = new Date().toISOString();
    serviceConfig.lastUpdated = new Date().toISOString();
    return await savePlatformConfig(platformId);
}

export async function setMaintenanceMode(enabled: boolean, message?: string): Promise<boolean> {
    serviceConfig.maintenanceMode = enabled;
    if (message !== undefined) serviceConfig.maintenanceMessage = message;
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

export async function setMaintenanceMessage(message: string): Promise<boolean> {
    serviceConfig.maintenanceMessage = message;
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

export async function setGlobalRateLimit(limit: number): Promise<boolean> {
    serviceConfig.globalRateLimit = Math.max(1, Math.min(1000, limit));
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

export async function setApiKeyRequired(required: boolean): Promise<boolean> {
    serviceConfig.apiKeyRequired = required;
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

export async function setPlaygroundEnabled(enabled: boolean): Promise<boolean> {
    serviceConfig.playgroundEnabled = enabled;
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

export async function setPlaygroundRateLimit(limit: number): Promise<boolean> {
    serviceConfig.playgroundRateLimit = Math.max(1, Math.min(100, limit));
    serviceConfig.lastUpdated = new Date().toISOString();
    return await saveGlobalConfig();
}

// Stats
export function recordRequest(platformId: PlatformId, success: boolean, responseTime: number): void {
    const platform = serviceConfig.platforms[platformId];
    if (!platform) return;
    platform.stats.totalRequests++;
    if (success) platform.stats.successCount++; else platform.stats.errorCount++;
    const total = platform.stats.totalRequests;
    platform.stats.avgResponseTime = ((platform.stats.avgResponseTime * (total - 1)) + responseTime) / total;
    if (platform.stats.totalRequests % 100 === 0) savePlatformConfig(platformId).catch(() => {});
}

export function resetPlatformStats(platformId: PlatformId): boolean {
    if (!serviceConfig.platforms[platformId]) return false;
    serviceConfig.platforms[platformId].stats = { totalRequests: 0, successCount: 0, errorCount: 0, avgResponseTime: 0 };
    savePlatformConfig(platformId).catch(() => {});
    return true;
}

export function resetAllStats(): void {
    for (const platformId of Object.keys(serviceConfig.platforms) as PlatformId[]) resetPlatformStats(platformId);
}

export async function updatePlatformConfig(platformId: PlatformId, updates: Partial<PlatformConfig>): Promise<boolean> {
    if (!serviceConfig.platforms[platformId]) return false;
    const platform = serviceConfig.platforms[platformId];
    if (updates.enabled !== undefined) platform.enabled = updates.enabled;
    if (updates.rateLimit !== undefined) platform.rateLimit = updates.rateLimit;
    if (updates.cacheTime !== undefined) platform.cacheTime = updates.cacheTime;
    if (updates.disabledMessage !== undefined) platform.disabledMessage = updates.disabledMessage;
    platform.lastUpdated = new Date().toISOString();
    serviceConfig.lastUpdated = new Date().toISOString();
    return await savePlatformConfig(platformId);
}

export async function resetToDefaults(): Promise<void> {
    serviceConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    serviceConfig.lastUpdated = new Date().toISOString();
    await saveGlobalConfig();
    for (const platformId of Object.keys(serviceConfig.platforms) as PlatformId[]) await savePlatformConfig(platformId);
}

loadConfigFromDB().catch(() => {});
