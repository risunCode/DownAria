/**
 * PWA Push Notifications Utility
 * Handles subscription management and notification sending
 */

// VAPID public key - set in .env as NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    return typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
    if (!isPushSupported()) {
        throw new Error('Push notifications not supported');
    }
    return Notification.requestPermission();
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as Uint8Array<ArrayBuffer>;
}

/**
 * Get current push subscription
 */
export async function getSubscription(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;

    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
    if (!isPushSupported()) {
        throw new Error('Push notifications not supported');
    }

    if (!VAPID_PUBLIC_KEY) {
        throw new Error('VAPID public key not configured');
    }

    // Request permission first
    const permission = await requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission denied');
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    }

    // Send subscription to server
    await saveSubscriptionToServer(subscription);

    return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
    const subscription = await getSubscription();

    if (subscription) {
        // Remove from server first
        await removeSubscriptionFromServer(subscription);
        // Then unsubscribe locally
        return subscription.unsubscribe();
    }

    return false;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Save subscription to server
 */
async function saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription: subscription.toJSON()
        })
    });

    if (!response.ok) {
        throw new Error('Failed to save subscription');
    }
}

/**
 * Remove subscription from server
 */
async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    await fetch(`${API_URL}/api/v1/push/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            endpoint: subscription.endpoint
        })
    });
}

/**
 * Check if user is subscribed
 */
export async function isSubscribed(): Promise<boolean> {
    const subscription = await getSubscription();
    return subscription !== null;
}

/**
 * Show local notification (for testing)
 */
export async function showLocalNotification(
    title: string,
    options?: NotificationOptions
): Promise<void> {
    if (!isPushSupported()) {
        throw new Error('Notifications not supported');
    }

    const permission = await requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission denied');
    }

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
        icon: '/icon.png',
        badge: '/icon.png',
        ...options
    });
}
