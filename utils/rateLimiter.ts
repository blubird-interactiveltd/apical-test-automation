/** Clock and wait the limiter runs on; injectable so the unit tests run instantly. */
export interface LimiterClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: LimiterClock = {
  now: () => Date.now(),
  sleep: (ms) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * A sliding-window limiter: at most `limit` calls start in any `windowMs`.
 *
 * The API throttles each user to 60 requests a minute (finding F-12). A caller
 * that would go over waits exactly until the oldest call leaves the window —
 * a computed wait, not a fixed sleep, so an idle suite never waits at all.
 */
export class SlidingWindowLimiter {
  private readonly starts: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: LimiterClock = realClock,
  ) {}

  /** Resolves when one more call may start, and records it. */
  async acquire(): Promise<void> {
    for (;;) {
      const now = this.clock.now();

      while (
        this.starts.length &&
        (this.starts[0] ?? 0) <= now - this.windowMs
      ) {
        this.starts.shift();
      }

      if (this.starts.length < this.limit) {
        this.starts.push(now);
        return;
      }

      await this.clock.sleep((this.starts[0] ?? now) + this.windowMs - now);
    }
  }

  /** Calls started in the current window. */
  get inWindow(): number {
    return this.starts.length;
  }
}
