// Finds bodies and countries by name or designation (SPEC 2.8).

import type { SolarContent, SpaceBodyDef } from "../astro/types";
import type { CountryDef } from "../content/index";
import { bodyClass } from "./solar/bodyFacts";

export interface SearchResult {
  kind: "body" | "country";
  id: string;
  name: string;
  /** What it is: a body's class, or "Country". */
  detail: string;
}

/** Bigger things first among equally good matches. */
const KIND_ORDER: Record<SpaceBodyDef["type"] | "country", number> = { star: 0, planet: 0, country: 1, dwarf: 2, moon: 2, asteroid: 3, comet: 3, asteroidalMoon: 4 };

/** Lower case, without accents or punctuation, so "cote d'ivoire" finds Côte d'Ivoire and "hiiaka" Hiʻiaka. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .toLowerCase()
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .trim();
}

/** How well a query fits some text: 0 is exact, then its start, a word's start, anywhere; null is no match. */
function fit(query: string, text: string): number | null {
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.includes(` ${query}`)) return 2;
  return text.includes(query) ? 3 : null;
}

export function search(content: SolarContent & { countries: CountryDef[] }, query: string, limit = 8): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const found: { result: SearchResult; fit: number; order: number }[] = [];
  const consider = (result: SearchResult, order: number, names: (string | undefined)[]) => {
    const fits = names.flatMap((n) => (n ? [fit(q, normalize(n))] : [])).filter((f) => f !== null);
    if (fits.length > 0) found.push({ result, fit: Math.min(...fits), order });
  };
  // A body's id can be a name it is also known by: Sol, Luna.
  for (const b of content.solarSystem) consider({ kind: "body", id: b.id, name: b.name, detail: bodyClass(b) }, KIND_ORDER[b.type], [b.name, b.designation, b.id]);
  for (const c of content.countries) consider({ kind: "country", id: c.id, name: c.name, detail: "Country" }, KIND_ORDER.country, [c.name]);
  found.sort((a, b) => a.fit - b.fit || a.order - b.order || a.result.name.length - b.result.name.length || a.result.name.localeCompare(b.result.name));
  return found.slice(0, limit).map((f) => f.result);
}
