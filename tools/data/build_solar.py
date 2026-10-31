"""Builds src/content/solarSystem.json from bodies.json and JPL's data.

    python3 -I tools/data/build_planets.py
    python3 -I tools/data/build_satellites.py
    python3 -I tools/data/build_small_bodies.py
    python3 -I tools/data/build_solar.py

bodies.json is the list of bodies, by hand: each one's id, what it is drawn as, where its data comes
from, its map and how real its imagery is. Their data comes from:

    planets        jpl_planets.json (build_planets.py): elements, their rates, sizes and masses
    moons          jpl_satellites.json (build_satellites.py), by JPL's satellite code
    small bodies   jpl_small_bodies.json (build_small_bodies.py), by designation
    anything else  solar_overrides.json, each entry naming its published source

Every orbit here is measured from the ecliptic, so a moon's plane tilts with its planet (see
moon_orbit). What no source gives is estimated and listed in the body's "estimated": a size from the
absolute magnitude and an assumed albedo, a mass from the size and an assumed density.

Orbits are Keplerian elements at an epoch: semi-major axis in AU, eccentricity, inclination, longitude
of the ascending node, argument of periapsis and mean anomaly. The build fails on a body with no
source, or whose parent is missing.
"""

import datetime
import json
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "content", "solarSystem.json")

AU_KM = 149597870.7
J2000_JD = 2451545.0
G = 6.6743e-11
OBLIQUITY_DEG = 23.4392911
# The poles the planets spin about (IAU, J2000), the way their moons go round: the IAU's own "north"
# for Uranus is the opposite end, as it turns backwards.
SPIN_POLES = {
    "Mars": (317.681, 52.887),
    "Jupiter": (268.057, 64.495),
    "Saturn": (40.589, 83.537),
    "Uranus": (77.311, 15.175),
    "Neptune": (299.36, 43.46),
    "Pluto": (132.993, -6.163),
}
# The IAU's 2015 nominal solar radius and the Sun's mass from its nominal GM.
SUN = {"radiusKm": 695700.0, "massKg": 1.3271244e20 / G}
# The dwarf planets in JPL's physical table, by their ids. Their shapes are drawn from a mean radius.
DWARF_PLANETS = {"Ceres", "Pluto", "Eris", "Makemake", "Haumea"}
# Assumed where nothing is measured: geometric albedos by orbit class, and densities in g/cm³.
ALBEDO = {"comet": 0.04, "transNeptunian": 0.1, "centaur": 0.07, "other": 0.14}
DENSITY = {"comet": 0.5, "transNeptunian": 1.0, "moon": 1.5, "other": 2.0}
# A small moon of no published size: about what Sheppard's surveys find at their faintest.
SMALL_MOON_RADIUS_KM = 2.0


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def julian_year(jd):
    return round(2000 + (jd - J2000_JD) / 365.25, 6)


def jpl_epoch(date):
    """A JPL epoch such as 2020-01-01.5, as a Julian year (2000.0 = J2000)."""
    day, _, fraction = date.partition(".")
    days = (datetime.date.fromisoformat(day) - datetime.date(2000, 1, 1)).days + float("0." + (fraction or "0")) - 0.5
    return round(2000 + days / 365.25, 6)


def moon_orbit(i, node, peri, pole):
    """
    Turns (i, node, argument of periapsis) in degrees, measured from the plane square to a pole
    (right ascension, declination) with the node counted from where that plane crosses the
    celestial equator going north, into the same measured from the ecliptic.
    """
    ra, dec = math.radians(pole[0]), math.radians(pole[1])
    z = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    x = (-math.sin(ra), math.cos(ra), 0.0)
    y = (z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0])
    ci, si, cn, sn, cw, sw = (f(math.radians(v)) for v, f in ((i, math.cos), (i, math.sin), (node, math.cos), (node, math.sin), (peri, math.cos), (peri, math.sin)))
    # Towards periapsis, and the orbit's pole, in that plane's axes.
    local_p = (cn * cw - sn * sw * ci, sn * cw + cn * sw * ci, sw * si)
    local_h = (sn * si, -cn * si, ci)
    ce, se = math.cos(math.radians(OBLIQUITY_DEG)), math.sin(math.radians(OBLIQUITY_DEG))

    def ecliptic(v):
        c = [v[0] * x[k] + v[1] * y[k] + v[2] * z[k] for k in range(3)]
        return c[0], c[1] * ce + c[2] * se, -c[1] * se + c[2] * ce

    p, h = ecliptic(local_p), ecliptic(local_h)
    new_i = math.degrees(math.acos(max(-1, min(1, h[2]))))
    new_node = math.atan2(h[0], -h[1])
    n = (math.cos(new_node), math.sin(new_node), 0.0)
    across = (h[1] * n[2] - h[2] * n[1], h[2] * n[0] - h[0] * n[2], h[0] * n[1] - h[1] * n[0])
    new_peri = math.atan2(sum(p[k] * across[k] for k in range(3)), sum(p[k] * n[k] for k in range(3)))
    return new_i, math.degrees(new_node) % 360, math.degrees(new_peri) % 360


def sphere_mass(radius_km, density):
    return 4 / 3 * math.pi * (radius_km * 1000) ** 3 * density * 1000


def planet_orbit(table):
    at, rate = table["at"], table["perCentury"]
    return {
        "a": at["a"],
        "e": at["e"],
        "i": at["i"],
        "node": at["node"] % 360,
        "peri": (at["peri"] - at["node"]) % 360,
        "meanAnomaly": (at["L"] - at["peri"]) % 360,
        "epoch": 2000,
        "perCentury": {
            "a": rate["a"],
            "e": rate["e"],
            "i": rate["i"],
            "node": rate["node"],
            "peri": rate["peri"] - rate["node"],
            "meanAnomaly": rate["L"] - rate["peri"],
        },
    }


def moon_data(moon, parent):
    """A moon's orbit from JPL's table, turned into the ecliptic."""
    a, e, i, node, peri, mean = moon["a_km"] / AU_KM, moon["e"], moon["i"], moon["node"], moon["peri"], moon["meanAnomaly"]
    orbit = {}
    frame = moon["frame"]
    if frame != "ecliptic":
        pole = (moon["poleRa"], moon["poleDec"]) if frame == "Laplace" else SPIN_POLES.get(parent)
        orbit["localI"] = i
        i, node, peri = moon_orbit(i, node, peri, pole)
        i = round(i, 6)
    return {"a": round(a, 10), "e": e, "i": i, "node": round(node, 6), "peri": round(peri, 6), "meanAnomaly": round(mean, 6), "epoch": jpl_epoch(moon["epoch"]), **orbit}


def small_body_class(data):
    name = data["orbitClass"].lower()
    if "comet" in name:
        return "comet"
    if "transneptunian" in name:
        return "transNeptunian"
    return "centaur" if "centaur" in name else "other"


def orbit_class(name):
    """JPL's name for a kind of orbit, as a heading."""
    name = name.rstrip("*").replace("TransNeptunian", "Trans-Neptunian")
    return f"Near-Earth Asteroid ({name})" if name in ("Amor", "Apollo", "Aten", "Atira") else name


def display_name(body, data):
    """The IAU's name, with the number for an asteroid, or else its designation."""
    full = data["fullName"].strip()
    comet = re.match(r"^(\d+[PD]/[^(]+)", full)
    if comet:
        return comet[1].strip()
    if "/" in full:
        return full
    match = re.match(r"^(\d+)?\s*([^(]*?)\s*(?:\(([^)]+)\))?$", full)
    number, name, provisional = match[1], match[2], match[3]
    if name:
        return name if body["type"] == "dwarf" or not number else f"{number} {name}"
    if body["type"] == "dwarf":
        return provisional
    return f"{number} ({provisional})" if number else provisional


def main():
    bodies = load("bodies.json")
    planets = load("jpl_planets.json")
    moons = {m["code"]: m for m in load("jpl_satellites.json")["moons"]}
    small = load("jpl_small_bodies.json")["bodies"]
    overrides = {k: v for k, v in load("solar_overrides.json").items() if not k.startswith("_")}
    out = []
    for body in bodies:
        kind, source = body["type"], body["source"]
        fix = overrides.get(body["id"], {})
        entry = {"id": body["id"], "name": body.get("name") or body["id"], "type": kind, "parent": body.get("parent", "Sol"), "imagery": body["imagery"]}
        estimated = []
        radius = mass = None
        cls = "moon"
        if source == "sun":
            entry["parent"] = None
            radius, mass = SUN["radiusKm"], SUN["massKg"]
        elif source == "planet":
            data = planets["physical"][body["id"]]
            radius, mass = data["equatorialRadiusKm"], data["massKg"]
            entry["orbit"] = planet_orbit(planets["orbits"][body["id"]])
        elif source == "moon":
            data = moons[body["designation"]]
            radius, mass = data.get("radiusKm"), data.get("massKg")
            entry["orbit"] = moon_data(data, entry["parent"])
        elif source == "sbdb":
            data = small[body["designation"]]
            cls = small_body_class(data)
            entry["name"] = body.get("name") or display_name(body, data)
            entry["designation"] = body["designation"]
            entry["orbitClass"] = orbit_class(data["orbitClass"])
            if "spectralType" in data:
                entry["spectralType"] = data["spectralType"]
            if "albedo" in data:
                entry["albedo"] = data["albedo"]
            if "diameterKm" in data:
                radius = data["diameterKm"] / 2
            if "gm" in data:
                mass = data["gm"] * 1e9 / G
            if body["id"] in planets["physical"]:
                radius, mass = planets["physical"][body["id"]]["meanRadiusKm"], planets["physical"][body["id"]]["massKg"]
            if radius is None:
                magnitude = data.get("H", data.get("M2"))
                if magnitude is not None:
                    albedo = data.get("albedo", ALBEDO[cls])
                    radius = 1329 / math.sqrt(albedo) * 10 ** (-magnitude / 5) / 2
                    estimated.append("radius")
            entry["orbit"] = {
                "a": data["a"],
                "e": data["e"],
                "i": data["i"],
                "node": data["node"] % 360,
                "peri": data["peri"] % 360,
                # A hyperbolic orbit's mean anomaly isn't an angle: it grows without end, so it keeps its turns.
                "meanAnomaly": data["meanAnomaly"] if data["e"] >= 1 else data["meanAnomaly"] % 360,
                "epoch": julian_year(data["epochJD"]),
            }
        elif source != "override":
            raise SystemExit(f"{body['id']}: unknown source {source}")

        if "orbit" in fix:
            o = fix["orbit"]
            entry["orbit"] = {"a": round(o["a_km"] / AU_KM, 10), "e": o["e"], "i": o["i"], "node": o["node"], "peri": o["peri"], "meanAnomaly": o["meanAnomaly"], "epoch": julian_year(o["epochJD"])}
        if "radiusKm" in fix:
            radius = fix["radiusKm"]
            if "radius" in estimated:
                estimated.remove("radius")
            if fix.get("radiusEstimated"):
                estimated.append("radius")
        if "massKg" in fix:
            mass = fix["massKg"]
        if radius is None:
            if kind not in ("moon", "asteroidalMoon"):
                raise SystemExit(f"{body['id']}: no size from any source")
            radius = SMALL_MOON_RADIUS_KM
            estimated.append("radius")
        if mass is None:
            mass = sphere_mass(radius, DENSITY.get(cls, DENSITY["other"]))
            estimated.append("mass")
        if source != "sun" and "orbit" not in entry:
            raise SystemExit(f"{body['id']}: no orbit from any source")
        entry["radiusKm"] = round(radius, 3)
        entry["massKg"] = float(f"{mass:.6g}")
        if estimated:
            entry["estimated"] = estimated
        out.append(entry)

    placed = set()
    # Parents before their moons, so a body's parent is always known when it is placed.
    order = {"star": 0, "planet": 1, "dwarf": 2, "moon": 3, "asteroidalMoon": 4, "asteroid": 5, "comet": 6}
    out.sort(key=lambda b: order[b["type"]])
    for entry in out:
        if entry["parent"] is not None and entry["parent"] not in placed:
            raise SystemExit(f"{entry['id']}: parent {entry['parent']} is not listed before it")
        placed.add(entry["id"])
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    counts = {}
    for entry in out:
        counts[entry["type"]] = counts.get(entry["type"], 0) + 1
    print(f"{len(out)} bodies: {counts}")
    print(f"estimated sizes: {sum('radius' in b.get('estimated', []) for b in out)}; estimated masses: {sum('mass' in b.get('estimated', []) for b in out)}")


if __name__ == "__main__":
    main()
