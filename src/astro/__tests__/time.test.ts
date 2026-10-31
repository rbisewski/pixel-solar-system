import { describe, expect, it } from "vitest";
import { advance, clampToRange, FAST_RATE, fromDateInput, toDateInput, MAX_MS, MIN_MS, RATES, stepRate, utcDay, yearsSinceJ2000 } from "../time";

describe("time", () => {
  it("counts Julian years from J2000", () => {
    expect(yearsSinceJ2000(Date.UTC(2000, 0, 1, 12))).toBe(0);
    expect(yearsSinceJ2000(Date.UTC(2030, 0, 1, 12))).toBeCloseTo(30, 1);
  });

  it("splits an instant into day of year and time of day", () => {
    expect(utcDay(Date.UTC(2026, 0, 1, 6))).toEqual({ dayOfYear: 0, dayFraction: 0.25 });
    expect(utcDay(Date.UTC(2024, 11, 31, 12))).toEqual({ dayOfYear: 365, dayFraction: 0.5 });
  });
});

describe("jumping to a date", () => {
  const at = Date.UTC(2026, 9, 31, 13, 30);

  it("keeps the time of day", () => {
    expect(toDateInput(at)).toBe("2026-10-31");
    expect(fromDateInput("1969-07-20", at)).toBe(Date.UTC(1969, 6, 20, 13, 30));
    expect(fromDateInput("2000-01-01", Date.UTC(1950, 0, 1, 6))).toBe(Date.UTC(2000, 0, 1, 6));
  });

  it("refuses what the clock doesn't cover", () => {
    expect(fromDateInput("1899-12-31", at)).toBeNull();
    expect(fromDateInput("2100-01-02", at)).toBeNull();
    expect(fromDateInput("", at)).toBeNull();
  });

  it("stops at the end of the range", () => {
    expect(fromDateInput("2100-01-01", at)).toBe(MAX_MS);
    expect(clampToRange(MIN_MS - 1)).toBe(MIN_MS);
  });
});

describe("the clock's steps", () => {
  const start = Date.UTC(2026, 0, 1);

  it("follows real time when live, however long the step", () => {
    expect(advance(start, 1, 100)).toBe(start + 100);
    expect(advance(start, 1, 60000)).toBe(start + 60000);
  });

  it("caps long steps at faster rates", () => {
    expect(advance(start, 3600, 100)).toBe(start + 360000);
    expect(advance(start, 3600, 60000)).toBe(start + 250 * 3600);
  });

  it("stands still when paused", () => {
    expect(advance(start, 0, 100)).toBe(start);
  });

  it("stops at the ends of its range", () => {
    expect(advance(MAX_MS - 1, 86400, 250)).toBe(MAX_MS);
    expect(advance(MIN_MS, -86400, 250)).toBe(MIN_MS);
  });

  it("steps through the rates", () => {
    expect(stepRate(0, 1)).toBe(1);
    expect(stepRate(1, 1)).toBe(3600);
    expect(stepRate(1, -1)).toBe(0);
    expect(stepRate(0, -1)).toBe(0);
    const fastest = RATES[RATES.length - 1]!.rate;
    expect(stepRate(fastest, 1)).toBe(fastest);
  });

  it("counts everything above live as fast", () => {
    expect(RATES.filter((r) => r.rate >= FAST_RATE).length).toBe(RATES.length - 1);
  });
});
