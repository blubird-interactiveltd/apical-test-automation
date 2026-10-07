import { describe, expect, it } from "vitest";
import {
  type LimiterClock,
  SlidingWindowLimiter,
} from "../../../utils/rateLimiter";

/** A fake clock whose sleep advances time instead of waiting. */
function fakeClock(): LimiterClock & { slept: number[] } {
  let now = 0;
  const slept: number[] = [];

  return {
    slept,
    now: () => now,
    sleep: async (ms) => {
      slept.push(ms);
      now += ms;
    },
  };
}

describe("SlidingWindowLimiter", () => {
  it("lets calls through without waiting while under the limit", async () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowLimiter(3, 60_000, clock);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(clock.slept).toEqual([]);
    expect(limiter.inWindow).toBe(3);
  });

  it("waits exactly until the oldest call leaves the window", async () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowLimiter(2, 60_000, clock);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(clock.slept).toEqual([60_000]);
    expect(limiter.inWindow).toBe(1);
  });
});
