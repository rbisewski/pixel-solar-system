"""Builds tools/data/jpl_satellites.json from JPL's planetary satellite tables.

    python3 -I tools/data/build_satellites.py

https://ssd.jpl.nasa.gov/sats/elem/ gives, for each moon, its elements at an epoch and the plane
they are measured from: the ecliptic (the irregular moons), the planet's equator, or the moon's
local Laplace plane, whose pole it also gives. build_solar.py turns them all into the ecliptic.

JPL Horizons gives the sizes and masses of those it knows, by the table's satellite code, for the
moons in bodies.json. Its answers are kept in tools/data/.cache/horizons/.
"""

import html
import json
import os
import re
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://ssd.jpl.nasa.gov/sats/elem/"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
AGENT = {"User-Agent": "pixel-solar-system-data/1.0"}
CACHE = os.path.join(HERE, ".cache", "horizons")
G = 6.6743e-11


def horizons(code):
    """Horizons' description of a satellite, by code."""
    path = os.path.join(CACHE, f"{code}.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    query = urllib.parse.urlencode({"format": "text", "COMMAND": f"'{code}'", "OBJ_DATA": "YES", "MAKE_EPHEM": "NO"})
    for attempt in range(6):
        try:
            text = urllib.request.urlopen(urllib.request.Request(f"{HORIZONS}?{query}", headers=AGENT), timeout=60).read().decode()
            break
        except OSError as error:
            print(f"{code}: {error}; trying again")
            time.sleep(5 * (attempt + 1))
    else:
        raise SystemExit(f"Horizons did not answer for {code}")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    time.sleep(0.25)
    return text


def physical(text):
    """Radius (mean, or the mean of the listed axes) and mass from Horizons' description, whose layouts vary."""
    out = {}
    block = text[: text.find("$$SOE")] if "$$SOE" in text else text
    radius = re.search(r"(?:mean radius|radius)[^=\n]*=\s*([\d.]+(?:\s*[xX]\s*[\d.]+)*)", block, re.I)
    if radius:
        axes = [float(v) for v in re.split(r"\s*[xX]\s*", radius.group(1))]
        product = 1.0
        for axis in axes:
            product *= axis
        out["radiusKm"] = round(product ** (1 / len(axes)), 3)
    gm = re.search(r"GM[^=\n,]*\(?km\^3/s\^2\)?\s*=\s*([\d.]+)", block) or re.search(r"GM, km\^3/s\^2\s*=\s*([\d.]+)", block)
    if gm and float(gm.group(1)) > 0:
        out["massKg"] = float(f"{float(gm.group(1)) * 1e9 / G:.6g}")
    else:
        mass = re.search(r"Mass[^(\n=]*\(?(?:x\s*)?10\^(\d+)\s*(?:kg|g)\s*\)?\s*=\s*([\d.]+)", block, re.I)
        if mass:
            out["massKg"] = float(mass.group(2)) * 10 ** int(mass.group(1))
    return out


def main():
    request = urllib.request.Request(URL, headers=AGENT)
    page = urllib.request.urlopen(request, timeout=60).read().decode()
    table = page[page.index("<tbody>") : page.index("</tbody>")]
    with open(os.path.join(HERE, "bodies.json"), encoding="utf-8") as f:
        wanted = {b["designation"] for b in json.load(f) if b["source"] == "moon"}
    rows = []
    for row in re.findall(r"<tr>(.*?)</tr>", table, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 20:
            continue
        moon = {
            "planet": cells[1],
            "name": cells[2],
            "code": cells[3],
            "frame": cells[5],
            "epoch": cells[6],
            "a_km": float(cells[7]),
            "e": float(cells[8]),
            "peri": float(cells[9]),
            "meanAnomaly": float(cells[10]),
            "i": float(cells[11]),
            "node": float(cells[12]),
            "poleRa": float(cells[16]) if cells[16] else None,
            "poleDec": float(cells[17]) if cells[17] else None,
        }
        if moon["code"] in wanted:
            moon.update(physical(horizons(moon["code"])))
        rows.append(moon)
    with open(os.path.join(HERE, "jpl_satellites.json"), "w", encoding="utf-8") as f:
        json.dump({"_source": [URL, HORIZONS], "moons": rows}, f, ensure_ascii=False, indent=0)
        f.write("\n")
    missing = wanted - {m["code"] for m in rows}
    sized = sum(1 for m in rows if "radiusKm" in m)
    print(f"{len(rows)} moons, {sized} with a size; not in the table: {sorted(missing) or 'none'}")


if __name__ == "__main__":
    main()
