import { describe, expect, it } from "vitest";
import { content } from "../../content/index";
import { normalize, search } from "../search";

const names = (query: string) => search(content, query).map((r) => r.name);

describe("search", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalize("Côte d'Ivoire")).toBe("cote divoire");
    expect(names("cote divoire")).toContain("Côte d'Ivoire");
    expect(names("hiiaka")).toContain("Hiʻiaka");
  });

  it("finds bodies and countries, the exact match first", () => {
    expect(names("mars")[0]).toBe("Mars");
    expect(names("vatican")).toEqual(["Vatican City"]);
    expect(search(content, "monaco")[0]).toMatchObject({ kind: "country", id: "mco" });
  });

  it("finds a body by its designation or other name", () => {
    expect(names("2012 VP113")).toContain("2012 VP113");
    expect(names("514041")[0]).toBe("514041 (2014 MQ18)");
    expect(names("19521")).toContain("Chaos");
    expect(names("sol")[0]).toBe("Sun");
  });

  it("finds a country the map has no room for", () => {
    for (const name of ["Liechtenstein", "San Marino"]) expect(names(name)).toEqual([name]);
  });

  it("finds nothing for nothing", () => {
    expect(search(content, "   ")).toEqual([]);
    expect(search(content, "zzzzqq")).toEqual([]);
  });

  it("keeps to the limit", () => {
    expect(search(content, "a")).toHaveLength(8);
  });
});
