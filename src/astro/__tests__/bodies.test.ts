import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { content } from "../../content/index";

const maps = new Set(readdirSync("public/map"));
const art = readFileSync("src/app/solar/bodyArt.ts", "utf8");
const listed = JSON.parse(readFileSync("tools/data/bodies.json", "utf8")) as { id: string; source: string; map?: string }[];

describe("the bodies", () => {
  it("keeps all 485", () => {
    expect(content.solarSystem.length).toBe(485);
  });

  it("gives each a real size, mass and imagery label", () => {
    for (const b of content.solarSystem) {
      expect(b.radiusKm, b.id).toBeGreaterThan(0);
      expect(b.massKg, b.id).toBeGreaterThan(0);
      expect(["spacecraft", "shape", "illustrative"]).toContain(b.imagery);
    }
  });

  it("has every map it lists", () => {
    for (const b of listed) if (b.map) expect(maps.has(`${b.map}.png`), b.id).toBe(true);
  });

  it("draws each body from the map listed for it", () => {
    for (const b of listed) if (b.map && b.id !== "Earth") expect(art, b.id).toContain(`"${b.map}.png"`);
  });

  it("uses no map that isn't listed", () => {
    const known = new Set(listed.flatMap((b) => (b.map ? [`${b.map}.png`] : [])));
    for (const file of maps) {
      if (file.endsWith("_shape.png") || ["earth.png", "regions.png", "borders.png"].includes(file)) continue;
      expect(known.has(file), file).toBe(true);
    }
  });
});
