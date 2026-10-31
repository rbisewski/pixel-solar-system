// The clock everything follows: positions, rotations, the terminator, sunspots and comet activity.
// It starts at the real time and runs on the frame loop, or paused for those who prefer reduced motion.

import { advance, clampToRange, stepRate, yearsSinceJ2000 } from "../astro/time";

/** How often readers see a new time, in ms: live time needs only its seconds to tick over. */
const LIVE_TICK_MS = 250;
const FAST_TICK_MS = 1000 / 30;

class Clock {
  /** The current instant, UTC milliseconds. */
  ms = $state(Date.now());
  /** Clock seconds per real second; 0 is paused. */
  rate = $state(matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1);
  years = $derived(yearsSinceJ2000(this.ms));

  /** The rate to come back to on resuming. */
  private resumeRate = 1;
  private exact = this.ms;
  private lastFrame = performance.now();
  private sincePublished = 0;

  constructor() {
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const step = Math.max(0, now - this.lastFrame);
    this.lastFrame = now;
    this.exact = advance(this.exact, this.rate, step);
    this.sincePublished += step;
    if (this.sincePublished >= (this.rate === 1 ? LIVE_TICK_MS : FAST_TICK_MS) && this.exact !== this.ms) {
      this.ms = this.exact;
      this.sincePublished = 0;
    }
  };

  setRate(rate: number): void {
    if (this.rate > 0) this.resumeRate = this.rate;
    this.rate = rate;
  }

  togglePause(): void {
    this.setRate(this.rate > 0 ? 0 : this.resumeRate);
  }

  faster(): void {
    this.setRate(stepRate(this.rate, 1));
  }

  slower(): void {
    this.setRate(stepRate(this.rate, -1));
  }

  /** Jumps to an instant, at the same rate. */
  jumpTo(ms: number): void {
    this.exact = this.ms = clampToRange(ms);
  }

  /** Back to the real time, running live. */
  now(): void {
    this.exact = this.ms = Date.now();
    this.setRate(1);
  }
}

export const clock = new Clock();
