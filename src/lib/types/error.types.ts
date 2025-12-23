/**
 * Scraper Error Codes - Shared with Backend
 * Provides specific error classification for better UX
 */

export enum ScraperErrorCode {
    // URL & Platform Errors
    INVALID_URL = 'INVALID_URL',
    UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
    
    // Authentication Errors
    COOKIE_REQUIRED = 'COOKIE_REQUIRED',
    COOKIE_EXPIRED = 'COOKIE_EXPIRED',
    COOKIE_INVALID = 'COOKIE_INVALID',
    COOKIE_BANNED = 'COOKIE_BANNED',
    CHECKPOINT_REQUIRED = 'CHECKPOINT_REQUIRED',
    
    // Content Errors
    NOT_FOUND = 'NOT_FOUND',
    PRIVATE_CONTENT = 'PRIVATE_CONTENT',
    AGE_RESTRICTED = 'AGE_RESTRICTED',
    NO_MEDIA = 'NO_MEDIA',
    DELETED = 'DELETED',
    CONTENT_REMOVED = 'CONTENT_REMOVED',
    GEO_BLOCKED = 'GEO_BLOCKED',
    
    // Network & API Errors
    TIMEOUT = 'TIMEOUT',
    RATE_LIMITED = 'RATE_LIMITED',
    BLOCKED = 'BLOCKED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    API_ERROR = 'API_ERROR',
    PARSE_ERROR = 'PARSE_ERROR',
    
    // Unknown
    UNKNOWN = 'UNKNOWN',
}

export const ERROR_MESSAGES: Record<ScraperErrorCode, string> = {
    [ScraperErrorCode.INVALID_URL]: 'Invalid URL format',
    [ScraperErrorCode.UNSUPPORTED_PLATFORM]: 'This platform is not supported',
    [ScraperErrorCode.COOKIE_REQUIRED]: 'This content requires login. Please provide a cookie.',
    [ScraperErrorCode.COOKIE_EXPIRED]: 'Your cookie has expired. Please update it.',
    [ScraperErrorCode.COOKIE_INVALID]: 'Invalid cookie format',
    [ScraperErrorCode.COOKIE_BANNED]: 'This account/cookie has been banned or restricted.',
    [ScraperErrorCode.NOT_FOUND]: 'Content not found. The post may have been deleted.',
    [ScraperErrorCode.PRIVATE_CONTENT]: 'This content is private',
    [ScraperErrorCode.AGE_RESTRICTED]: 'This content is age-restricted. Please provide a cookie.',
    [ScraperErrorCode.NO_MEDIA]: 'No downloadable media found',
    [ScraperErrorCode.DELETED]: 'This content has been deleted',
    [ScraperErrorCode.CONTENT_REMOVED]: 'This content was removed by the user or platform.',
    [ScraperErrorCode.GEO_BLOCKED]: 'This content is not available in your region.',
    [ScraperErrorCode.TIMEOUT]: 'Request timed out. Please try again.',
    [ScraperErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment.',
    [ScraperErrorCode.BLOCKED]: 'Request was blocked by the platform',
    [ScraperErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
    [ScraperErrorCode.API_ERROR]: 'Platform API error',
    [ScraperErrorCode.PARSE_ERROR]: 'Failed to parse response',
    [ScraperErrorCode.CHECKPOINT_REQUIRED]: 'Account verification required. Please check your account.',
    [ScraperErrorCode.UNKNOWN]: 'An unexpected error occurred',
};
