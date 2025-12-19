/**
 * Format Utilities
 * Shared formatting functions for bytes, speed, duration
 */

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format download speed
 * @param bytesPerSec - Bytes per second
 * @returns Object with MB/s and Mbit/s formatted strings
 */
export function formatSpeed(bytesPerSec: number): { mb: string; mbit: string } {
    const mbps = bytesPerSec / (1024 * 1024);
    const mbitps = (bytesPerSec * 8) / (1024 * 1024);
    return {
        mb: mbps.toFixed(2) + ' MB/s',
        mbit: mbitps.toFixed(1) + ' Mbit/s'
    };
}

/**
 * Parse file size string to bytes
 * @param sizeStr - Size string like "24.3 MB"
 * @returns Number of bytes or undefined if parsing fails
 */
export function parseFileSizeToBytes(sizeStr: string): number | undefined {
    const match = sizeStr.match(/([\d.]+)\s*(KB|MB|GB)/i);
    if (!match) return undefined;
    
    const num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
        case 'GB': return num * 1024 * 1024 * 1024;
        case 'MB': return num * 1024 * 1024;
        case 'KB': return num * 1024;
        default: return undefined;
    }
}
