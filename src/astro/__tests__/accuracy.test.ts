import { describe, expect, it } from "vitest";
import { content } from "../../content/index";
import { solarPositions } from "../orbits";
import { yearsSinceJ2000 } from "../time";
import horizons from "./horizons.json";

const truth = horizons.positions as unknown as Record<string, Record<string, [number, number, number]>>;
const PLANETS = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

/** Degrees between two positions' heliocentric longitudes. */
function longitudeGap(x1: number, y1: number, x2: number, y2: number): number {
  const gap = Math.abs(Math.atan2(y1, x1) - Math.atan2(y2, x2)) * (180 / Math.PI);
  return gap > 180 ? 360 - gap : gap;
}

function gapAt(id: string, date: string): number {
  const [x, y] = truth[id]![date]!;
  const at = solarPositions(content, yearsSinceJ2000(Date.parse(`${date}T00:00:00Z`))).get(id)!;
  return longitudeGap(at.x, at.y, x, y);
}

describe("positions against JPL Horizons", () => {
  it("keeps the planets within 1° of their longitudes from 1950 to 2050", () => {
    for (const id of PLANETS) {
      for (const date of ["1950-01-01", "2000-01-01", "2026-07-01", "2050-01-01"]) expect(gapAt(id, date), `${id} at ${date}`).toBeLessThan(1);
    }
  });

  it("keeps them within 2° at the clock's far ends", () => {
    for (const id of PLANETS) {
      for (const date of ["1900-01-01", "2100-01-01"]) expect(gapAt(id, date), `${id} at ${date}`).toBeLessThan(2);
    }
  });

  it("puts a small body right near its epoch", () => {
    expect(gapAt("433Eros", "2026-07-01")).toBeLessThan(1);
  });
});
