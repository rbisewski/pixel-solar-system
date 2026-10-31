// Keplerian orbits of the solar system's bodies (src/content/solarSystem.json, from JPL
// and the published literature). Positions are in AU in the ecliptic frame: x towards the vernal equinox, y 90°
// east of it in the ecliptic, z towards the ecliptic north pole. Each body moves on a fixed
// ellipse around its parent at the mean motion Kepler's third law gives, but for the planets,
// whose elements change at JPL's rates (apsidal and
// nodal precession of moons is left out), and the interstellar objects, on hyperbolas.

import type { OrbitDef, SolarContent, SpaceBodyDef } from "./types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const G = 6.674e-11;
const AU_M = 149597870700;
/** A Julian year in seconds. */
const YEAR_S = 31557600;
const DEG = 3.141592653589793 / 180;
const TWO_PI = 6.283185307179586;
/** An object on a hyperbola is shown within this far from its parent (AU). */
const SHOWN_WITHIN_AU = 130;

/** Whether an orbit is open: the body comes once, and never returns. */
export function isHyperbolic(orbit: OrbitDef): boolean {
  return orbit.e >= 1;
}

/** Mean motion in radians per Julian year around a parent of the given mass. */
export function meanMotion(orbit: OrbitDef, parentMassKg: number, massKg = 0): number {
  const a = Math.abs(orbit.a) * AU_M;
  return Math.sqrt((G * (parentMassKg + massKg)) / (a * a * a)) * YEAR_S;
}

/** Orbital period in Julian years. */
export function orbitalPeriod(orbit: OrbitDef, parentMassKg: number, massKg = 0): number {
  return TWO_PI / meanMotion(orbit, parentMassKg, massKg);
}

/** Eccentric anomaly for a mean anomaly in [−π, π], by Newton's method. */
function eccentricAnomaly(mean: number, e: number): number {
  let E = e < 0.8 ? mean : mean < 0 ? -3.141592653589793 : 3.141592653589793;
  for (let k = 0; k < 30; k++) {
    const step = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return E;
}

/** Hyperbolic anomaly for a mean anomaly, by Newton's method from where it runs far from the Sun. */
function hyperbolicAnomaly(mean: number, e: number): number {
  let H = Math.asinh(mean / e);
  for (let k = 0; k < 50; k++) {
    const step = (e * Math.sinh(H) - H - mean) / (e * Math.cosh(H) - 1);
    H -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return H;
}

/** A hyperbola's mean anomaly in radians, negative before periapsis, years after J2000. */
function hyperbolicMean(orbit: OrbitDef, parentMassKg: number, massKg: number, years: number): number {
  return orbit.meanAnomaly * DEG + meanMotion(orbit, parentMassKg, massKg) * (years - (orbit.epoch - 2000));
}

/** A point on the orbit's ellipse, from its eccentric anomaly, rotated into the ecliptic frame. */
function pointAt(orbit: OrbitDef, E: number): Vec3 {
  const { a, e } = orbit;
  return rotated(orbit, a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E));
}

/** A point in the orbit's plane (x towards periapsis) rotated into the ecliptic frame. */
function rotated(orbit: OrbitDef, px: number, py: number): Vec3 {
  const cn = Math.cos(orbit.node * DEG);
  const sn = Math.sin(orbit.node * DEG);
  const ci = Math.cos(orbit.i * DEG);
  const si = Math.sin(orbit.i * DEG);
  const cw = Math.cos(orbit.peri * DEG);
  const sw = Math.sin(orbit.peri * DEG);
  return {
    x: (cn * cw - sn * sw * ci) * px + (-cn * sw - sn * cw * ci) * py,
    y: (sn * cw + cn * sw * ci) * px + (-sn * sw + cn * cw * ci) * py,
    z: sw * si * px + cw * si * py,
  };
}

/** A planet's elements a number of Julian centuries after their epoch. */
function atTime(orbit: OrbitDef, rates: NonNullable<OrbitDef["perCentury"]>, centuries: number): OrbitDef {
  return {
    ...orbit,
    a: orbit.a + rates.a * centuries,
    e: orbit.e + rates.e * centuries,
    i: orbit.i + rates.i * centuries,
    node: orbit.node + rates.node * centuries,
    peri: orbit.peri + rates.peri * centuries,
    meanAnomaly: orbit.meanAnomaly + rates.meanAnomaly * centuries,
  };
}

/** Where a body is relative to its parent, years after J2000. */
export function orbitPosition(orbit: OrbitDef, parentMassKg: number, massKg: number, years: number): Vec3 {
  if (isHyperbolic(orbit)) {
    const H = hyperbolicAnomaly(hyperbolicMean(orbit, parentMassKg, massKg, years), orbit.e);
    return rotated(orbit, orbit.a * (Math.cosh(H) - orbit.e), -orbit.a * Math.sqrt(orbit.e * orbit.e - 1) * Math.sinh(H));
  }
  const rates = orbit.perCentury;
  const at = rates ? atTime(orbit, rates, (years - (orbit.epoch - 2000)) / 100) : orbit;
  const raw = rates ? at.meanAnomaly * DEG : orbit.meanAnomaly * DEG + meanMotion(orbit, parentMassKg, massKg) * (years - (orbit.epoch - 2000));
  const mean = raw - TWO_PI * Math.floor(raw / TWO_PI + 0.5);
  return pointAt(at, eccentricAnomaly(mean, at.e));
}

/** Whether a body is near enough to show, years after J2000; only those on hyperbolas ever leave. */
export function withinView(orbit: OrbitDef, parentMassKg: number, massKg: number, years: number): boolean {
  if (!isHyperbolic(orbit)) return true;
  const p = orbitPosition(orbit, parentMassKg, massKg, years);
  return Math.hypot(p.x, p.y, p.z) <= SHOWN_WITHIN_AU;
}

/** The orbit's ellipse as points spaced evenly in eccentric anomaly (closer together at periapsis). */
export function orbitPath(orbit: OrbitDef, segments: number): Vec3[] {
  return Array.from({ length: segments }, (_, k) => pointAt(orbit, (TWO_PI * k) / segments));
}

/** Every body's position relative to the Sun, years after J2000. */
export function solarPositions(content: SolarContent, years: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const mass = new Map<string, number>();
  for (const b of content.solarSystem) {
    mass.set(b.id, b.massKg);
    if (!b.orbit || b.parent === null) {
      out.set(b.id, { x: 0, y: 0, z: 0 });
      continue;
    }
    const parent = out.get(b.parent)!;
    const p = orbitPosition(b.orbit, mass.get(b.parent)!, b.massKg, years);
    out.set(b.id, { x: parent.x + p.x, y: parent.y + p.y, z: parent.z + p.z });
  }
  return out;
}

/** A body by id. */
export function spaceBody(content: SolarContent, id: string): SpaceBodyDef {
  const body = content.solarSystem.find((b) => b.id === id);
  if (!body) throw new Error(`Unknown space body "${id}"`);
  return body;
}
