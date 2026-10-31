import { describe, expect, it } from "vitest";
import { content } from "../../content/index";
import { orbitalPeriod, orbitPath, solarPositions, spaceBody } from "../orbits";

const dist = (p: { x: number; y: number; z: number }, q = { x: 0, y: 0, z: 0 }) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

describe("orbits", () => {
  it("lists each body after the one it orbits", () => {
    const placed = new Set<string>();
    for (const b of content.solarSystem) {
      expect(b.parent === null || (placed.has(b.parent) && b.orbit !== undefined)).toBe(true);
      placed.add(b.id);
    }
  });

  it("puts the Earth where it was at J2000", () => {
    // JPL Horizons, heliocentric ecliptic J2000: (−0.177, 0.967, 0).
    const earth = solarPositions(content, 0).get("Earth")!;
    expect(earth.x).toBeCloseTo(-0.177, 1);
    expect(earth.y).toBeCloseTo(0.967, 1);
    expect(Math.abs(earth.z)).toBeLessThan(0.001);
  });

  it("gives the real periods", () => {
    const sun = spaceBody(content, "Sol").massKg;
    const earth = spaceBody(content, "Earth");
    const luna = spaceBody(content, "Luna");
    expect(orbitalPeriod(earth.orbit!, sun, earth.massKg)).toBeCloseTo(1, 2);
    expect(orbitalPeriod(luna.orbit!, earth.massKg, luna.massKg) * 365.25).toBeCloseTo(27.3, 0);
    const jupiter = spaceBody(content, "Jupiter");
    expect(orbitalPeriod(jupiter.orbit!, sun, jupiter.massKg)).toBeCloseTo(11.86, 1);
  });

  it("keeps every body on its orbit as time passes", () => {
    for (const years of [30, 30.5, 47.2]) {
      const at = solarPositions(content, years);
      for (const b of content.solarSystem) {
        const p = at.get(b.id)!;
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        // A planet's ellipse itself changes.
        if (!b.orbit || b.orbit.perCentury) continue;
        // Between periapsis and apoapsis of its parent.
        const r = dist(p, at.get(b.parent!)!);
        expect(r).toBeGreaterThanOrEqual(b.orbit.a * (1 - b.orbit.e) * 0.999999);
        expect(r).toBeLessThanOrEqual(b.orbit.a * (1 + b.orbit.e) * 1.000001);
      }
    }
    expect(dist(solarPositions(content, 30).get("Luna")!, solarPositions(content, 30).get("Earth")!) * 149597870.7).toBeGreaterThan(356000);
  });

  it("traces the ellipse", () => {
    const mars = spaceBody(content, "Mars").orbit!;
    const path = orbitPath(mars, 64);
    expect(Math.min(...path.map((p) => dist(p)))).toBeCloseTo(mars.a * (1 - mars.e), 6);
    expect(Math.max(...path.map((p) => dist(p)))).toBeCloseTo(mars.a * (1 + mars.e), 6);
  });
});
