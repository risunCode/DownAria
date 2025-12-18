/**
 * Integrations Module
 * ===================
 * External service integrations.
 * 
 * This module consolidates:
 * - lib/utils/discord-webhook.ts (Discord notifications)
 * - lib/utils/push-notifications.ts (Web push)
 * 
 * Usage:
 *   import { sendDiscordNotification, subscribeToPush } from '@/lib/integrations';
 */

// ═══════════════════════════════════════════════════════════════
// DISCORD
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
