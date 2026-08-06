/**
 * Offline Manager
 * Handles offline state and request queuing.
 * Ported from Flyx 2.0.
 */

export interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
}

class OfflineManager {
  private isOffline = false;
  private readonly queue: QueuedRequest[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOffline = !navigator.onLine;
      window.addEventListener('online', () => {
        this.isOffline = false;
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.isOffline = true;
      });
    }
  }

  getIsOffline(): boolean {
    return this.isOffline;
  }

  queueRequest(url: string, options: RequestInit): string {
    const id = Math.random().toString(36).substring(2);
    this.queue.push({
      id,
      url,
      options,
      timestamp: Date.now(),
    });
    return id;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue.length = 0;
  }

  private async processQueue(): Promise<void> {
    const requests = [...this.queue];
    this.queue.length = 0;

    for (const request of requests) {
      try {
        await fetch(request.url, request.options);
      } catch (error) {
        console.error('Failed to process queued request:', error);
        // Re-queue failed requests
        this.queue.push(request);
      }
    }
  }
}

export const offlineManager = new OfflineManager();
