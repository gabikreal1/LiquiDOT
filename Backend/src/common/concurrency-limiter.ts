/**
 * Simple semaphore-based concurrency limiter.
 * Queues excess calls and processes them as capacity becomes available.
 */
export class ConcurrencyLimiter {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number = 10) {}

  /**
   * Execute an async function with concurrency limiting.
   * If at capacity, queues the call until a slot opens.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.running--;
    }
  }

  /** Current number of active executions */
  get activeCount(): number {
    return this.running;
  }

  /** Number of calls waiting in queue */
  get queueLength(): number {
    return this.queue.length;
  }
}
