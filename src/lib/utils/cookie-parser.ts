/**
 * Universal Cookie Parser
 * 
 * Centralized cookie parsing for all platforms.
 * Supports multiple input formats and validates platform-specific requirements.
 */

// ============================================================================
// TYPES
// ============================================================================

export type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

interface CookieObject {
    name?: string;
    value?: string;
    domain?: string;
}

interface ValidationResult {
    valid: boolean;
    missing?: string[];
    info?: {
        userId?: string;
        sessionId?: string;
        pairCount: number;
    };
}

// ============================================================================
// DOMAIN PATTERNS (for filtering JSON cookies by platform)
// ============================================================================

const DOMAIN_PATTERNS: Record<CookiePlatform, string[]> = {
    facebook: ['.facebook.com', 'facebook.com', '.fb.com'],
    instagram: ['.instagram.com', 'instagram.com'],
    weibo: ['.weibo.com', 'weibo.com', '.weibo.cn'],
    twitter: ['.twitter.com', 'twitter.com', '.x.com', 'x.com'],
};

// ============================================================================
// REQUIRED COOKIES (for validation)
// ============================================================================

const REQUIRED_COOKIES: Record<CookiePlatform, string[]> = {
    facebook: ['c_user', 'xs'],           // User ID + Session
    instagram: ['sessionid'],              // Session ID (ds_user_id optional)
    weibo: ['SUB'],                        // Session token
    twitter: ['auth_token'],               // Auth token (ct0 for CSRF)
};

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse cookie from any format to string format "name=value; name2=value2"
 * 
 * Supported inputs:
 * - JSON string: '[{"name":"c_user","value":"xxx"}, ...]'
 * - String format: 'c_user=xxx; xs=xxx; datr=xxx'
 * - Array of objects: [{name: "c_user", value: "xxx"}, ...]
 * - Single object: {name: "c_user", value: "xxx"}
 * 
 * @param input - Cookie input in any format
 * @param platform - Optional platform for domain filtering
 * @returns Cookie string or null if invalid
 */
export function parseCookie(input: unknown, platform?: CookiePlatform): string | null {
    if (!input) return null;
    
    let pairs: { name: string; value: string }[] = [];
    
    // Case 1: String input
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return null;
        
        // JSON array string
        if (trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed) as CookieObject[];
                if (Array.isArray(arr)) {
                    pairs = filterAndExtract(arr, platform);
                }
            } catch {
                // Not valid JSON, treat as cookie string
                return trimmed;
            }
        } else {
            // Already in string format
            return trimmed;
        }
    }
    // Case 2: Array input (from JSON body parsing)
    else if (Array.isArray(input)) {
        pairs = filterAndExtract(input as CookieObject[], platform);
    }
    // Case 3: Single object
    else if (typeof input === 'object' && input !== null) {
        const obj = input as CookieObject;
        if (obj.name && obj.value) {
            pairs = [{ name: obj.name, value: obj.value }];
        }
    }
    
    if (pairs.length === 0) return null;
    
    return pairs.map(p => `${p.name}=${p.value}`).join('; ');
}

/**
 * Filter cookies by domain and extract name/value pairs
 */
function filterAndExtract(
    cookies: CookieObject[], 
    platform?: CookiePlatform
): { name: string; value: string }[] {
    let filtered = cookies;
    
    // Filter by domain if platform specified
    if (platform && DOMAIN_PATTERNS[platform]) {
        const patterns = DOMAIN_PATTERNS[platform];
        filtered = cookies.filter(c => {
            if (!c.domain) return true; // Keep if no domain specified
            const domain = c.domain.toLowerCase();
            return patterns.some(p => domain.includes(p.replace('.', '')));
        });
    }
    
    // Extract valid pairs
    return filtered
        .filter(c => c.name && c.value)
        .map(c => ({ name: c.name!, value: c.value! }));
}

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validate cookie has required fields for platform
 * 
 * @param cookie - Cookie string
 * @param platform - Platform to validate for
 * @returns Validation result with missing cookies if any
 */
export function validateCookie(cookie: string | null, platform: CookiePlatform): ValidationResult {
    if (!cookie) {
        return { valid: false, missing: REQUIRED_COOKIES[platform] };
    }
    
    const pairs = parseCookiePairs(cookie);
    const required = REQUIRED_COOKIES[platform];
    const missing = required.filter(name => !pairs.some(p => p.name === name));
    
    // Extract info
    const info = extractCookieInfo(pairs, platform);
    
    return {
        valid: missing.length === 0,
        missing: missing.length > 0 ? missing : undefined,
        info,
    };
}

/**
 * Parse cookie string to array of pairs
 */
function parseCookiePairs(cookie: string): { name: string; value: string }[] {
    const pairs: { name: string; value: string }[] = [];
    
    // Try JSON first
    if (cookie.trim().startsWith('[')) {
        try {
            const arr = JSON.parse(cookie);
            if (Array.isArray(arr)) {
                arr.forEach((c: CookieObject) => {
                    if (c.name && c.value) pairs.push({ name: c.name, value: c.value });
                });
                return pairs;
            }
        } catch { /* fall through */ }
    }
    
    // String format
    cookie.split(';').forEach(pair => {
        const [name, ...valueParts] = pair.trim().split('=');
        if (name && valueParts.length) {
            pairs.push({ name: name.trim(), value: valueParts.join('=').trim() });
        }
    });
    
    return pairs;
}

/**
 * Extract platform-specific info from cookie
 */
function extractCookieInfo(
    pairs: { name: string; value: string }[], 
    platform: CookiePlatform
): ValidationResult['info'] {
    const info: ValidationResult['info'] = { pairCount: pairs.length };
    
    switch (platform) {
        case 'facebook': {
            const cUser = pairs.find(p => p.name === 'c_user');
            const xs = pairs.find(p => p.name === 'xs');
            if (cUser) info.userId = cUser.value;
            if (xs) info.sessionId = xs.value.substring(0, 20) + '...';
            break;
        }
        case 'instagram': {
            const dsUser = pairs.find(p => p.name === 'ds_user_id');
            const sessionId = pairs.find(p => p.name === 'sessionid');
            if (dsUser) info.userId = dsUser.value;
            if (sessionId) info.sessionId = sessionId.value.substring(0, 20) + '...';
            break;
        }
        case 'weibo': {
            const sub = pairs.find(p => p.name === 'SUB');
            if (sub) info.sessionId = sub.value.substring(0, 20) + '...';
            break;
        }
        case 'twitter': {
            const authToken = pairs.find(p => p.name === 'auth_token');
            if (authToken) info.sessionId = authToken.value.substring(0, 20) + '...';
            break;
        }
    }
    
    return info;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if input looks like a cookie (has at least one name=value pair)
 */
export function isCookieLike(input: unknown): boolean {
    if (!input) return false;
    
    if (typeof input === 'string') {
        const trimmed = input.trim();
        // JSON array
        if (trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed);
                return Array.isArray(arr) && arr.some((c: CookieObject) => c.name && c.value);
            } catch {
                return false;
            }
        }
        // String format
        return trimmed.includes('=');
    }
    
    if (Array.isArray(input)) {
        return input.some((c: CookieObject) => c.name && c.value);
    }
    
    return false;
}

/**
 * Get cookie format type
 */
export function getCookieFormat(input: unknown): 'json' | 'string' | 'array' | 'unknown' {
    if (!input) return 'unknown';
    
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('[')) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch {
                return 'unknown';
            }
        }
        return 'string';
    }
    
    if (Array.isArray(input)) return 'array';
    
    return 'unknown';
}
