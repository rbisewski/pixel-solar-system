import { describe, expect, it } from "vitest";
import { content } from "../../content/index";
import { isHyperbolic, orbitalPeriod, orbitPath, orbitPosition, solarPositions, spaceBody, withinView } from "../orbits";

const dist = (p: { x: number; y: number; z: number }, q = { x: 0, y: 0, z: 0 }) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

describe("hyperbolic orbits", () => {
  const sun = spaceBody(content, "Sol").massKg;
  const shown = (id: string, years: number) => {
    const b = spaceBody(content, id);
    return withinView(b.orbit!, sun, b.massKg, years);
  };
  const distance = (id: string, years: number) => {
    const b = spaceBody(content, id);
    return dist(orbitPosition(b.orbit!, sun, b.massKg, years));
  };
  /** The time on one side of closest approach at which a body is a distance from the Sun, by bisection. */
  const when = (id: string, au: number, near: number, far: number) => {
    for (let k = 0; k < 60; k++) {
      const mid = (near + far) / 2;
      if (distance(id, mid) < au) near = mid;
      else far = mid;
    }
    return near;
  };

  it("marks only the interstellar objects", () => {
    expect(content.solarSystem.filter((b) => b.orbit && isHyperbolic(b.orbit)).map((b) => b.id)).toEqual(["1IOumuamua", "2IBorisov", "3IAtlas"]);
  });

  it("shows each within 130 AU, coming in and going out", () => {
    for (const [id, closest] of [["1IOumuamua", 17.7], ["2IBorisov", 19.9], ["3IAtlas", 25.8]] as const) {
      const entering = when(id, 130, closest, closest - 100);
      const leaving = when(id, 130, closest, closest + 100);
      expect(shown(id, entering - 0.01), id).toBe(false);
      expect(shown(id, entering + 0.01), id).toBe(true);
      expect(shown(id, closest), id).toBe(true);
      expect(shown(id, leaving - 0.01), id).toBe(true);
      expect(shown(id, leaving + 0.01), id).toBe(false);
    }
  });

  it("never hides a body on a closed orbit", () => {
    const pluto = spaceBody(content, "Pluto");
    expect(withinView(pluto.orbit!, sun, pluto.massKg, 100)).toBe(true);
    expect(shown("Sedna", 0)).toBe(true);
  });
});

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
        // A planet's ellipse itself changes, and a hyperbola has no apoapsis.
        if (!b.orbit || b.orbit.perCentury || isHyperbolic(b.orbit)) continue;
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
