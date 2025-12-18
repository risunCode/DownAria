/**
 * Type declarations for web-push module
 */
declare module 'web-push' {
    interface PushSubscription {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    }

    interface SendResult {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
    }

    interface WebPushError extends Error {
        statusCode: number;
        headers: Record<string, string>;
        body: string;
        endpoint: string;
    }

    function setVapidDetails(
        subject: string,
        publicKey: string,
        privateKey: string
    ): void;

    function sendNotification(
        subscription: PushSubscription,
        payload?: string | Buffer | null,
        options?: {
            TTL?: number;
            headers?: Record<string, string>;
            contentEncoding?: string;
            proxy?: string;
            agent?: unknown;
            timeout?: number;
        }
    ): Promise<SendResult>;

    function generateVAPIDKeys(): {
        publicKey: string;
        privateKey: string;
    };

    export { setVapidDetails, sendNotification, generateVAPIDKeys, PushSubscription, SendResult, WebPushError };
}
