// The app's data, loaded from the JSON files next to this module.

import type { SolarContent, SpaceBodyDef } from "../astro/types";
import countries from "./countries.json";
import regions from "./regions.json";
import solarSystem from "./solarSystem.json";

/** A published figure and the year it is for, with its source unless that is the World Bank. */
export interface Figure {
  value: number;
  /** Null where the source gives no year. */
  year: number | null;
  source?: string;
}

export interface CountryDef {
  id: string;
  name: string;
  capital: { name: string; lat: number; lon: number };
  population: Figure;
  /** US dollars, or null where no source gives one. */
  gdp: Figure | null;
  /** US dollars. */
  gdpPerCapita: Figure | null;
  /** Land area in km². */
  area: Figure;
}

/** A cluster of a country's provinces, which only drives city lights. */
export interface RegionDef {
  countryId: string;
  population: number;
  areaKm2: number;
}

export const content: SolarContent & { countries: CountryDef[]; regions: RegionDef[] } = {
  solarSystem: solarSystem as unknown as SpaceBodyDef[],
  countries,
  regions,
};
