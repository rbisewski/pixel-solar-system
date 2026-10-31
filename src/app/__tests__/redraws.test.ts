import { describe, expect, it } from "vitest";
import { runRedraws } from "../solar/redraws";

/** Redraws that each take a millisecond on a fake clock, noting the order they ran in. */
function timed(urgencies: number[]) {
  let time = 0;
  const ran: number[] = [];
  const redraws = urgencies.map((urgency) => ({
    urgency,
    run: () => {
      ran.push(urgency);
      time += 1;
    },
  }));
  return { redraws, ran, now: () => time };
}

describe("runRedraws", () => {
  it("runs the most urgent first and stops when the budget is spent", () => {
    const { redraws, ran, now } = timed([1, 3, 2, 4]);
    expect(runRedraws(redraws, 2, now)).toBe(2);
    expect(ran).toEqual([4, 3]);
  });

  it("runs everything when the budget allows", () => {
    const { redraws, ran, now } = timed([1, 2]);
    expect(runRedraws(redraws, 10, now)).toBe(2);
    expect(ran).toEqual([2, 1]);
  });

  it("always runs one, however small the budget", () => {
    const { redraws, ran, now } = timed([1, 2]);
    expect(runRedraws(redraws, 0, now)).toBe(1);
    expect(ran).toEqual([2]);
  });

  it("does nothing with nothing to run", () => {
    expect(runRedraws([], 2, () => 0)).toBe(0);
  });
});
