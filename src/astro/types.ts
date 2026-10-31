// The solar system's bodies as src/content/solarSystem.json holds them (tools/data/build_solar.py).

export type SpaceBodyType = "star" | "planet" | "moon" | "asteroidalMoon" | "dwarf" | "asteroid" | "comet";

export interface OrbitDef {
  /** Semi-major axis, AU; negative on a hyperbolic orbit, whose eccentricity is 1 or more. */
  a: number;
  e: number;
  /** Inclination, ascending node, argument of periapsis and mean anomaly at the epoch, degrees; all from the ecliptic. */
  i: number;
  node: number;
  peri: number;
  meanAnomaly: number;
  /** Julian year of the elements (2000 = J2000). */
  epoch: number;
  /** For a moon going round its planet's equator: its inclination to that, the figure usually quoted. */
  localI?: number;
  /** A planet's elements change: how much per Julian century, a in AU and the rest in degrees. The mean anomaly then runs at this rate, not Kepler's. */
  perCentury?: Pick<OrbitDef, "a" | "e" | "i" | "node" | "peri" | "meanAnomaly">;
}

export interface SpaceBodyDef {
  id: string;
  name: string;
  type: SpaceBodyType;
  /** The body it orbits; null for the Sun. */
  parent: string | null;
  radiusKm: number;
  massKg: number;
  /** Absent for the Sun. */
  orbit?: OrbitDef;
  /** How far to trust its surface: a spacecraft's map, a measured shape, or an artist's impression. */
  imagery: "spacecraft" | "shape" | "illustrative";
  /** Its number or designation in JPL's Small-Body Database, for small bodies. */
  designation?: string;
  /** JPL's name for its kind of orbit ("Jupiter-family Comet", "Trans-Neptunian Object"…), for small bodies. */
  orbitClass?: string;
  /** Which of its figures no source gives. */
  estimated?: ("radius" | "mass")[];
}

/** What placing the bodies needs: parents are listed before their moons. */
export interface SolarContent {
  solarSystem: SpaceBodyDef[];
}
