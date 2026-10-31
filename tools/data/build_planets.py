"""Builds tools/data/jpl_planets.json from JPL's planetary tables.

    python3 -I tools/data/build_planets.py

The orbits are JPL's Keplerian Elements for Approximate Positions, Table 1 (valid 1800 AD to 2050 AD;
https://ssd.jpl.nasa.gov/planets/approx_pos.html): each element at J2000 and its rate per century.
The sizes and masses are its Planetary Physical Parameters
(https://ssd.jpl.nasa.gov/planets/phys_par.html), which also lists the five dwarf planets.
"""

import html
import json
import os
import re
import urllib.request

ELEMENTS_URL = "https://ssd.jpl.nasa.gov/planets/approx_pos.html"
PHYSICAL_URL = "https://ssd.jpl.nasa.gov/planets/phys_par.html"
# Table 1's row for the Earth-Moon barycentre stands for the Earth.
ELEMENT_ROWS = {"Mercury": "Mercury", "Venus": "Venus", "EM Bary": "Earth", "Mars": "Mars", "Jupiter": "Jupiter", "Saturn": "Saturn", "Uranus": "Uranus", "Neptune": "Neptune"}
FIELDS = ("a", "e", "i", "L", "peri", "node")


def page(url):
    request = urllib.request.Request(url, headers={"User-Agent": "pixel-solar-system-data/1.0"})
    return urllib.request.urlopen(request, timeout=60).read().decode()


def table_rows(text):
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.S):
        yield [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]


def number(text):
    return float(re.match(r"[-+]?[\d.]+(?:[eE][-+]?\d+)?", text.replace(" ", "")).group())


def elements():
    """Table 1 is the first <pre> or table holding the planets' two rows of six numbers each."""
    text = page(ELEMENTS_URL)
    start = text.index("1800&nbsp;AD - 2050") if "1800&nbsp;AD - 2050" in text else text.index("1800 AD - 2050")
    plain = re.sub(r"<[^>]+>", " ", text[start:])
    out = {}
    for row, planet in ELEMENT_ROWS.items():
        match = re.search(re.escape(row) + r"[^\d\-+]*((?:[-+]?\d+\.\d+\s+){12})", plain)
        if not match:
            raise SystemExit(f"Table 1 has no row for {row}")
        values = [float(v) for v in match.group(1).split()]
        out[planet] = {"at": dict(zip(FIELDS, values[:6])), "perCentury": dict(zip(FIELDS, values[6:]))}
    return out


def physical():
    out = {}
    scale = 1e24
    for cells in table_rows(page(PHYSICAL_URL)):
        if cells and cells[0].startswith("DwarfPlanet"):
            scale = 1e18
        if len(cells) < 4 or not re.match(r"^[A-Z][a-z]+$", cells[0]):
            continue
        try:
            out[cells[0]] = {"equatorialRadiusKm": number(cells[1]), "meanRadiusKm": number(cells[2]), "massKg": number(cells[3]) * scale}
        except (AttributeError, ValueError):
            continue
    return out


def main():
    data = {"_source": [ELEMENTS_URL, PHYSICAL_URL], "orbits": elements(), "physical": physical()}
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jpl_planets.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(data['orbits'])} orbits; physical data for {', '.join(data['physical'])}")


if __name__ == "__main__":
    main()
