/**
 * Integrations Module
 * ===================
 * External service integrations.
 * 
 * This module consolidates:
 * - lib/utils/discord-webhook.ts (Discord notifications)
 * - lib/utils/push-notifications.ts (Web push)
 * - lib/integrations/admin-alerts.ts (Admin Discord alerts)
 * 
 * Usage:
 *   import { sendDiscordNotification, subscribeToPush } from '@/lib/integrations';
 */

// ═══════════════════════════════════════════════════════════════
// DISCORD (User-side)
// ═══════════════════════════════════════════════════════════════

export {
    sendDiscordNotification,
    getUserDiscordSettings,
    saveUserDiscordSettings,
    DEFAULT_USER_DISCORD,
    DISCORD_STORAGE_KEY,
    type UserDiscordSettings,
} from '@/lib/utils/discord-webhook';

// ═══════════════════════════════════════════════════════════════
// ADMIN ALERTS (Discord)
// ═══════════════════════════════════════════════════════════════

export {
    getAlertConfig,
    updateAlertConfig,
    trackError,
    trackSuccess,
    checkCookiePoolHealth,
    sendTestAlert,
    updateLastHealthCheck,
    clearConfigCache,
    type AlertConfig,
} from '@/lib/integrations/admin-alerts';

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export {
    isPushSupported,
    getPermissionStatus,
    requestPermission,
    getSubscription,
    subscribeToPush,
    unsubscribeFromPush,
    isSubscribed,
    showLocalNotification,
} from '@/lib/utils/push-notifications';
