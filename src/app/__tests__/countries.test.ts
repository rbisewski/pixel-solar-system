import { describe, expect, it } from "vitest";
import { flagUrl } from "../ui/flags";
import { content } from "../../content/index";

describe("countries", () => {
  const ids = new Set(content.countries.map((c) => c.id));

  it("lists every sovereign country as itself", () => {
    expect(ids.size).toBe(content.countries.length);
    for (const id of ["vat", "smr", "mco", "and", "lie", "atg", "tuv", "nru", "xkx", "pse", "twn"]) expect(ids).toContain(id);
    for (const id of ["ecs", "pis", "ata", "sol", "cyn", "sah"]) expect(ids).not.toContain(id);
    expect(content.countries).toHaveLength(197);
  });

  it("gives each a flag, a capital and dated figures", () => {
    for (const c of content.countries) {
      expect(flagUrl(c.id), c.id).toBeTruthy();
      expect(c.capital.name, c.id).toBeTruthy();
      expect(c.population.value, c.id).toBeGreaterThan(0);
      expect(c.population.year, c.id).toBeGreaterThanOrEqual(2019);
      expect(c.area.value, c.id).toBeGreaterThan(0);
      if (c.gdp) expect(c.gdpPerCapita?.year, c.id).toBe(c.gdp.year);
    }
    expect(content.countries.filter((c) => !c.gdp).map((c) => c.id)).toEqual(["vat"]);
  });

  it("gives every region a country, and only leaves the smallest without one", () => {
    for (const r of content.regions) expect(ids, r.countryId).toContain(r.countryId);
    const held = new Set(content.regions.map((r) => r.countryId));
    expect([...ids].filter((id) => !held.has(id))).toEqual(["lie", "mco", "smr", "vat"]);
  });
});
