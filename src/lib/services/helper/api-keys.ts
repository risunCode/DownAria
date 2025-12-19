/**
 * API Key Manager
 * Generate, validate, and manage API keys (Supabase storage)
 */

import crypto from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const getWriteClient = () => supabaseAdmin || supabase;
const getReadClient = () => supabase;

export interface ApiKey {
    id: string;
    name: string;
    key: string;
    hashedKey: string;
    enabled: boolean;
    rateLimit: number;
    created: string;
    lastUsed: string | null;
    expiresAt: string | null;
    stats: { totalRequests: number; successCount: number; errorCount: number };
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let keysCache: ApiKey[] = [];
let lastCacheTime = 0;
const CACHE_TTL = 10000;

function generateKeyId(): string { return crypto.randomBytes(8).toString('hex'); }

type KeyFormat = 'alphanumeric' | 'hex' | 'base64';

function generateApiKeyString(prefix: string = 'xtf_live', length: number = 32, format: KeyFormat = 'alphanumeric'): string {
    let random: string;
    switch (format) {
        case 'hex': random = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length); break;
        case 'base64': random = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64url').slice(0, length); break;
        default:
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const bytes = crypto.randomBytes(length);
            random = Array.from(bytes).map(b => chars[b % chars.length]).join('');
    }
    const cleanPrefix = prefix.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `${cleanPrefix}_${random}`;
}

function hashKey(key: string): string { return crypto.createHash('sha256').update(key).digest('hex'); }

async function loadKeysFromDB(): Promise<ApiKey[]> {
    const db = getReadClient();
    if (!db) return [];
    try {
        const { data, error } = await db.from('api_keys').select('*').order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(row => ({
            id: row.id, name: row.name, key: row.key_preview, hashedKey: row.key_hash,
            enabled: row.enabled, rateLimit: row.rate_limit, created: row.created_at,
            lastUsed: row.last_used, expiresAt: row.expires_at,
            stats: { totalRequests: row.total_requests || 0, successCount: row.success_count || 0, errorCount: row.error_count || 0 }
        }));
    } catch { return []; }
}

async function ensureFreshCache(): Promise<void> {
    if (Date.now() - lastCacheTime > CACHE_TTL) { keysCache = await loadKeysFromDB(); lastCacheTime = Date.now(); }
}

export async function createApiKey(name: string, options?: { rateLimit?: number; expiresInDays?: number; isTest?: boolean; keyLength?: number; keyFormat?: KeyFormat; prefix?: string }): Promise<{ key: ApiKey; plainKey: string }> {
    const db = getWriteClient();
    const id = generateKeyId();
    const keyLength = Math.max(16, Math.min(64, options?.keyLength || 32));
    let prefix = options?.prefix?.trim();
    if (!prefix) prefix = options?.isTest ? 'xtf_test' : 'xtf_live';
    const plainKey = generateApiKeyString(prefix, keyLength, options?.keyFormat || 'alphanumeric');
    const hashedKey = hashKey(plainKey);
    const keyPreview = plainKey.slice(0, 12) + '...' + plainKey.slice(-4);
    const expiresAt = options?.expiresInDays ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    if (db) {
        const { error } = await db.from('api_keys').insert({ id, name, key_hash: hashedKey, key_preview: keyPreview, enabled: true, rate_limit: options?.rateLimit || 60, expires_at: expiresAt, total_requests: 0, success_count: 0, error_count: 0 });
        if (error) return { key: {} as ApiKey, plainKey: '' };
    }
    lastCacheTime = 0;
    return { key: { id, name, key: keyPreview, hashedKey, enabled: true, rateLimit: options?.rateLimit || 60, created: new Date().toISOString(), lastUsed: null, expiresAt, stats: { totalRequests: 0, successCount: 0, errorCount: 0 } }, plainKey };
}

export async function getApiKey(id: string): Promise<ApiKey | null> { await ensureFreshCache(); return keysCache.find(k => k.id === id) || null; }
export async function getAllApiKeys(): Promise<ApiKey[]> { await ensureFreshCache(); return keysCache; }

export async function updateApiKey(id: string, updates: Partial<Pick<ApiKey, 'name' | 'enabled' | 'rateLimit'>>): Promise<boolean> {
    const db = getWriteClient();
    if (!db) return false;
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.rateLimit !== undefined) updateData.rate_limit = Math.max(1, Math.min(1000, updates.rateLimit));
    const { error } = await db.from('api_keys').update(updateData).eq('id', id);
    if (error) return false;
    lastCacheTime = 0;
    return true;
}

export async function deleteApiKey(id: string): Promise<boolean> {
    const db = getWriteClient();
    if (!db) return false;
    const { error } = await db.from('api_keys').delete().eq('id', id);
    if (error) return false;
    lastCacheTime = 0;
    return true;
}

export async function regenerateApiKey(id: string): Promise<{ key: ApiKey; plainKey: string } | null> {
    const db = getWriteClient();
    if (!db) return null;
    const existing = await getApiKey(id);
    if (!existing) return null;
    const isTest = existing.key.includes('test');
    const plainKey = generateApiKeyString(isTest ? 'test' : 'live');
    const hashedKey = hashKey(plainKey);
    const keyPreview = plainKey.slice(0, 12) + '...' + plainKey.slice(-4);
    const { error } = await db.from('api_keys').update({ key_hash: hashedKey, key_preview: keyPreview, total_requests: 0, success_count: 0, error_count: 0 }).eq('id', id);
    if (error) return null;
    lastCacheTime = 0;
    return { key: { ...existing, key: keyPreview, hashedKey, stats: { totalRequests: 0, successCount: 0, errorCount: 0 } }, plainKey };
}

export interface ValidateResult { valid: boolean; error?: string; key?: ApiKey; remaining?: number }

export async function validateApiKey(plainKey: string): Promise<ValidateResult> {
    if (!plainKey || plainKey.length < 10 || !plainKey.includes('_')) return { valid: false, error: 'Invalid API key format' };
    const hashedInput = hashKey(plainKey);
    const db = getReadClient();
    if (!db) return { valid: false, error: 'Database unavailable' };
    const { data, error } = await db.from('api_keys').select('*').eq('key_hash', hashedInput).single();
    if (error || !data) return { valid: false, error: 'Invalid API key' };
    if (!data.enabled) return { valid: false, error: 'API key is disabled' };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false, error: 'API key has expired' };
    const rateCheck = checkKeyRateLimit(data.id, data.rate_limit);
    if (!rateCheck.allowed) return { valid: false, error: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s`, remaining: 0 };
    getWriteClient()?.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', data.id);
    return { valid: true, key: { id: data.id, name: data.name, key: data.key_preview, hashedKey: data.key_hash, enabled: data.enabled, rateLimit: data.rate_limit, created: data.created_at, lastUsed: new Date().toISOString(), expiresAt: data.expires_at, stats: { totalRequests: data.total_requests, successCount: data.success_count, errorCount: data.error_count } }, remaining: rateCheck.remaining };
}

function checkKeyRateLimit(keyId: string, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const entry = rateLimitMap.get(keyId);
    if (!entry || entry.resetAt < now) { rateLimitMap.set(keyId, { count: 1, resetAt: now + windowMs }); return { allowed: true, remaining: limit - 1, resetIn: windowMs }; }
    if (entry.count >= limit) return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now };
}

export async function recordKeyUsage(keyId: string, success: boolean): Promise<void> {
    const db = getWriteClient();
    if (!db) return;
    if (success) await db.rpc('increment_api_key_success', { key_id: keyId });
    else await db.rpc('increment_api_key_error', { key_id: keyId });
}

export async function resetKeyStats(keyId: string): Promise<boolean> {
    const db = getWriteClient();
    if (!db) return false;
    const { error } = await db.from('api_keys').update({ total_requests: 0, success_count: 0, error_count: 0 }).eq('id', keyId);
    lastCacheTime = 0;
    return !error;
}

export function extractApiKey(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const apiKeyHeader = request.headers.get('X-API-Key');
    if (apiKeyHeader) return apiKeyHeader;
    const url = new URL(request.url);
    return url.searchParams.get('key') || url.searchParams.get('api_key');
}
