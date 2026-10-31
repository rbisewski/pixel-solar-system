"""Builds tools/data/jpl_small_bodies.json from JPL's Small-Body Database.

    python3 -I tools/data/build_small_bodies.py

Asks https://ssd-api.jpl.nasa.gov/sbdb.api for each asteroid, comet and dwarf planet in bodies.json,
by its designation, and keeps its name, orbit class, orbital elements and what is measured of it. Its
answers are kept in tools/data/.cache/sbdb/.
"""

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://ssd-api.jpl.nasa.gov/sbdb.api"
CACHE = os.path.join(HERE, ".cache", "sbdb")
ELEMENTS = {"a": "a", "e": "e", "i": "i", "om": "node", "w": "peri", "ma": "meanAnomaly"}
MEASURED = {"diameter": "diameterKm", "GM": "gm", "H": "H", "M2": "M2", "albedo": "albedo"}


def sbdb(designation):
    path = os.path.join(CACHE, re.sub(r"\W", "_", designation) + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    url = f"{API}?" + urllib.parse.urlencode({"sstr": designation, "phys-par": 1, "full-prec": 1})
    request = urllib.request.Request(url, headers={"User-Agent": "pixel-solar-system-data/1.0"})
    for attempt in range(6):
        try:
            data = json.load(urllib.request.urlopen(request, timeout=60))
            break
        except OSError as error:
            print(f"{designation}: {error}; trying again")
            time.sleep(5 * (attempt + 1))
    else:
        raise SystemExit(f"SBDB did not answer for {designation}")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    time.sleep(0.25)
    return data


def main():
    with open(os.path.join(HERE, "bodies.json"), encoding="utf-8") as f:
        wanted = [b for b in json.load(f) if b["source"] == "sbdb"]
    out = {}
    for body in wanted:
        data = sbdb(body["designation"])
        if "object" not in data:
            raise SystemExit(f"{body['id']}: SBDB has no single object for {body['designation']}: {data.get('message')}")
        elements = {e["name"]: e["value"] for e in data["orbit"]["elements"]}
        physical = {p["name"]: p["value"] for p in data.get("phys_par", [])}
        spectral = physical.get("spec_T") or physical.get("spec_B")
        entry = {
            "fullName": data["object"]["fullname"],
            "orbitClass": data["object"]["orbit_class"]["name"],
            "epochJD": float(data["orbit"]["epoch"]),
            **{to: float(elements[key]) for key, to in ELEMENTS.items()},
            **{to: float(physical[key]) for key, to in MEASURED.items() if physical.get(key)},
        }
        if spectral:
            entry["spectralType"] = spectral
        out[body["designation"]] = entry
    with open(os.path.join(HERE, "jpl_small_bodies.json"), "w", encoding="utf-8") as f:
        json.dump({"_source": API, "bodies": out}, f, ensure_ascii=False, indent=0)
        f.write("\n")
    print(f"{len(out)} small bodies")


if __name__ == "__main__":
    main()
