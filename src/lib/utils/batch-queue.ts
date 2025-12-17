/**
 * Batch Download Queue
 * Process multiple URLs one by one with progress tracking
 */

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
    id: string;
    url: string;
    platform?: string;
    status: QueueItemStatus;
    error?: string;
    addedAt: number;
}

export interface BatchQueue {
    items: QueueItem[];
    isProcessing: boolean;
    currentIndex: number;
}

export function createQueue(): BatchQueue {
    return { items: [], isProcessing: false, currentIndex: -1 };
}

export function addToQueue(queue: BatchQueue, url: string): BatchQueue {
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        ...queue,
        items: [...queue.items, { id, url, status: 'pending', addedAt: Date.now() }],
    };
}

export function removeFromQueue(queue: BatchQueue, id: string): BatchQueue {
    return { ...queue, items: queue.items.filter(item => item.id !== id) };
}

export function clearQueue(queue: BatchQueue): BatchQueue {
    return { items: [], isProcessing: false, currentIndex: -1 };
}

export function updateItemStatus(
    queue: BatchQueue,
    id: string,
    status: QueueItemStatus,
    error?: string
): BatchQueue {
    return {
        ...queue,
        items: queue.items.map(item =>
            item.id === id ? { ...item, status, error } : item
        ),
    };
}

export function getNextPending(queue: BatchQueue): QueueItem | null {
    return queue.items.find(item => item.status === 'pending') || null;
}

export function getQueueStats(queue: BatchQueue) {
    const total = queue.items.length;
    const completed = queue.items.filter(i => i.status === 'completed').length;
    const failed = queue.items.filter(i => i.status === 'failed').length;
    const pending = queue.items.filter(i => i.status === 'pending').length;
    const processing = queue.items.filter(i => i.status === 'processing').length;
    return { total, completed, failed, pending, processing };
}
