// Time for the clock: a UTC instant in milliseconds, its Julian years since J2000, and the rates
// the clock can run at.

const DAY_MS = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const JULIAN_YEAR_MS = 365.25 * DAY_MS;

/** The range the clock covers. */
export const MIN_MS = Date.UTC(1900, 0, 1);
export const MAX_MS = Date.UTC(2100, 0, 1);

/** An instant kept within the clock's range. */
export function clampToRange(ms: number): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}

/** An instant as a date input holds it: 2026-10-31, in UTC. */
export function toDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A date input's value at the same time of day as an instant, or null if it isn't a date in the clock's range. */
export function fromDateInput(value: string, ms: number): number | null {
  const midnight = Date.parse(`${value}T00:00:00Z`);
  const timeOfDay = ((ms % DAY_MS) + DAY_MS) % DAY_MS;
  if (Number.isNaN(midnight) || midnight < MIN_MS || midnight > MAX_MS) return null;
  return clampToRange(midnight + timeOfDay);
}

/** Clock seconds per real second, slowest first. Paused is a rate of 0. */
export const RATES = [
  { rate: 1, label: "Live" },
  { rate: 3600, label: "1h/s" },
  { rate: 86400, label: "1d/s" },
  { rate: 7 * 86400, label: "1w/s" },
  { rate: 30.4375 * 86400, label: "1mo/s" },
  { rate: 365.25 * 86400, label: "1y/s" },
] as const;

/** From this rate on, bodies race past fast enough to count as fast for the motion settings. */
export const FAST_RATE = 3600;

/** The longest real step a running clock takes in one go, so a sleeping tab doesn't leap ahead. */
const LONGEST_STEP_MS = 250;

/** Julian years since J2000 (2000-01-01 12:00 UTC). */
export function yearsSinceJ2000(ms: number): number {
  return (ms - J2000_MS) / JULIAN_YEAR_MS;
}

/** The day of the year (0 = 1 January) and the time of day as a fraction of 24 h, in UTC. */
export function utcDay(ms: number): { dayOfYear: number; dayFraction: number } {
  const start = Date.UTC(new Date(ms).getUTCFullYear(), 0, 1);
  const days = (ms - start) / DAY_MS;
  const dayOfYear = Math.floor(days);
  return { dayOfYear, dayFraction: days - dayOfYear };
}

/**
 * The instant a real time step later, kept within the clock's range. Live time follows real time
 * however long the step was; faster rates cap it.
 */
export function advance(ms: number, rate: number, realMs: number): number {
  const step = rate === 1 ? realMs : Math.min(realMs, LONGEST_STEP_MS);
  return clampToRange(ms + step * rate);
}

/** The next rate up or down from the current one; from paused, up is the slowest and down stays paused. */
export function stepRate(rate: number, direction: 1 | -1): number {
  const index = RATES.findIndex((r) => r.rate === rate);
  if (index < 0) return direction > 0 ? RATES[0].rate : rate;
  return RATES[index + direction]?.rate ?? (direction > 0 ? rate : 0);
}
