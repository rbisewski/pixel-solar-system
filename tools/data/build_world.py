"""Builds the Earth layer from real-world data (SPEC 5.4).

Inputs come from tools/data/.cache (run fetch.py first). Outputs:
  src/content/countries.json  every sovereign country, with its latest actual figures
  src/content/regions.json    clusters of each country's provinces, which only drive city lights
  public/map/earth.png        pixel-art Earth texture (equirectangular)
  public/map/regions.png      region id map for picking and lights (RGB = region index + 1, 0 = sea)
  public/map/borders.png      country border overlay (RGBA)

Run: python3 -I tools/data/build_world.py
Needs numpy and Pillow.
"""

from __future__ import annotations

import json
import math
import pathlib
from collections import defaultdict

import numpy as np
from PIL import Image, ImageDraw
from PIL.ImageFilter import GaussianBlur as ImageFilterGaussian

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "tools/data/.cache"
CONTENT = ROOT / "src/content"
MAP_OUT = ROOT / "public/map"

# Map resolution. Pixel art texture and id map share it so a texel is a pickable unit.
W, H = 2048, 1024
TARGET_REGIONS = 360
EARTH_RADIUS_KM = 6371.0

# ---------------------------------------------------------------------------
# Country membership

# Disputed areas go to the de facto administrator, and Aland to Finland, its sovereign.
FOLD = {
    "SOL": "SOM",  # Somaliland
    "CYN": "CYP",  # Northern Cyprus
    "KAS": "IND",  # Siachen Glacier
    "SAH": "MAR",  # Western Sahara
    "ALD": "FIN",
}

# Natural Earth's codes for the countries our ids (and the World Bank) spell differently.
OWN_UNIT = {"PSE": "PSX", "XKX": "KOS"}
COUNTRY_OF_UNIT = {unit: key for key, unit in OWN_UNIT.items()}

NAME_OVERRIDES = {
    "USA": "United States",
    "RUS": "Russia",
    "KOR": "South Korea",
    "PRK": "North Korea",
    "COD": "DR Congo",
    "COG": "Congo",
    "LAO": "Laos",
    "SYR": "Syria",
    "IRN": "Iran",
    "VNM": "Vietnam",
    "BRN": "Brunei",
    "CZE": "Czechia",
    "MKD": "North Macedonia",
    "SWZ": "Eswatini",
    "PSE": "Palestine",
    "TWN": "Taiwan",
    "XKX": "Kosovo",
    "CIV": "Côte d'Ivoire",
    "GBR": "United Kingdom",
    "BHS": "Bahamas",
    "GMB": "Gambia",
    "FSM": "Micronesia",
    "VAT": "Vatican City",
    "CPV": "Cabo Verde",
    "STP": "São Tomé and Príncipe",
}

# Where Natural Earth's capital isn't the official one, or it flags several.
CAPITAL_OVERRIDES = {
    "ZAF": "Pretoria", "BOL": "La Paz", "NLD": "Amsterdam", "PSE": "Ramallah", "BEN": "Porto-Novo", "BDI": "Gitega",
    "CIV": "Yamoussoukro", "LKA": "Sri Jayawardenepura Kotte", "MMR": "Naypyidaw", "TZA": "Dodoma",
}
# Names of capitals as they should read, where Natural Earth's are out of date or unusual in English.
CAPITAL_NAMES = {
    "AND": "Andorra la Vella", "COL": "Bogotá", "DNK": "Copenhagen", "KAZ": "Astana", "PLW": "Ngerulmud", "USA": "Washington, D.C.",
}
# Nauru has no official capital and no place in Natural Earth's list: Yaren is its seat of government.
MANUAL_CAPITALS = {"NRU": {"name": "Yaren", "lat": -0.55, "lon": 166.92, "pop": 0}}
# Natural Earth's populated places spell a few countries differently from its borders.
PLACE_UNITS = {"SSD": "SDS"}

# Figures the World Bank does not publish, or last published long ago: (value, year, source).
MANUAL_STATS = {
    "TWN": {
        # DGBAS reports US$39,477 a head for 2025, which agrees with this total at this population.
        "population": (23.33e6, 2025, "Estimate, GeoRank"),
        "gdp": (920e9, 2025, "IMF WEO, via GlobalNote"),
    },
    # A nominal GNI: the Bank of Korea's estimates of North Korea publish no nominal GDP.
    "PRK": {"gdp": (32.01e9, 2024, "Bank of Korea, nominal GNI")},
    # The World Bank's last figure is for 2011.
    "ERI": {"gdp": (2.28e9, 2023, "UN, via Worldometer")},
    # Natural Earth's outline is too coarse to measure it by.
    "VAT": {"area": (0.44, None, "Vatican City State")},
}


def lon_to_x(lon: float) -> float:
    return (lon + 180.0) / 360.0 * W


def lat_to_y(lat: float) -> float:
    return (90.0 - lat) / 180.0 * H


def polygons(geometry: dict):
    if geometry["type"] == "Polygon":
        yield geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        yield from geometry["coordinates"]


def ring_area(ring: list) -> float:
    """The area inside a ring of (lon, lat) points, in km²."""
    total = 0.0
    for (x0, y0, *_), (x1, y1, *_) in zip(ring, ring[1:]):
        total += math.radians(x1 - x0) * (2 + math.sin(math.radians(y0)) + math.sin(math.radians(y1)))
    return abs(total) / 2 * EARTH_RADIUS_KM**2


def feature_area(geometry: dict) -> float:
    return sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in polygons(geometry))


def texel_area(lat: float) -> float:
    """The area of a map texel at a latitude, in km²."""
    return (2 * math.pi * EARTH_RADIUS_KM / W) * (math.pi * EARTH_RADIUS_KM / H) * max(math.cos(math.radians(lat)), 0.01)


def draw_feature(draw: ImageDraw.ImageDraw, geometry: dict, value: int) -> None:
    for poly in polygons(geometry):
        outer, *holes = poly
        if len(outer) >= 3:
            draw.polygon([(lon_to_x(x), lat_to_y(y)) for x, y, *_ in outer], fill=value)
        for hole in holes:
            # A hole smaller than a texel (the Vatican in Rome) would only leave a false pit of sea.
            if len(hole) >= 3 and ring_area(hole) >= texel_area(hole[0][1]):
                draw.polygon([(lon_to_x(x), lat_to_y(y)) for x, y, *_ in hole], fill=0)


def unit_vector(lat: float, lon: float) -> np.ndarray:
    la, lo = math.radians(lat), math.radians(lon)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])


# ---------------------------------------------------------------------------
# Statistics


def world_bank(indicator: str) -> dict[str, list[tuple[int, float]]]:
    rows = json.loads((CACHE / f"wb_actual_{indicator}.json").read_text())[1]
    out: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for r in rows:
        if r["countryiso3code"] and r["value"] is not None:
            out[r["countryiso3code"]].append((int(r["date"]), float(r["value"])))
    for series in out.values():
        series.sort()
    return out


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def figure(value: float, year: int | None, source: str | None = None) -> dict:
    out = {"value": float(f"{value:.5g}"), "year": year}
    if source:
        out["source"] = source
    return out


def main() -> None:
    admin0 = json.loads((CACHE / "ne_50m_admin_0_countries.geojson").read_text())["features"]
    admin1 = json.loads((CACHE / "ne_10m_admin_1_states_provinces.geojson").read_text())["features"]
    places = json.loads((CACHE / "ne_10m_populated_places_simple.geojson").read_text())["features"]

    # --- Which country does each Natural Earth unit belong to?
    main_iso_by_sov: dict[str, str] = {}
    for f in admin0:
        p = f["properties"]
        if p["ADMIN"] == p["SOVEREIGNT"]:
            main_iso_by_sov[p["SOV_A3"]] = p["ADM0_A3"]

    def country_key(adm0_a3: str, sov_a3: str) -> str | None:
        if adm0_a3 == "ATA":
            return None
        if adm0_a3 in FOLD:
            return FOLD[adm0_a3]
        if adm0_a3 in COUNTRY_OF_UNIT:
            return COUNTRY_OF_UNIT[adm0_a3]
        main = main_iso_by_sov.get(sov_a3, adm0_a3)
        return COUNTRY_OF_UNIT.get(main, main)

    unit_country: dict[str, str] = {}
    unit_props: dict[str, dict] = {}
    unit_geometry: dict[str, dict] = {}
    members: dict[str, list[str]] = defaultdict(list)
    for f in admin0:
        p = f["properties"]
        key = country_key(p["ADM0_A3"], p["SOV_A3"])
        if key:
            unit_country[p["ADM0_A3"]] = key
            unit_props[p["ADM0_A3"]] = p
            unit_geometry[p["ADM0_A3"]] = f["geometry"]
            members[key].append(p["ADM0_A3"])

    # --- Latest actual figures, each with its year. A country's figures are its own unit's:
    # the World Bank counts dependencies apart, and some share their sovereign's ISO code.
    population_series = world_bank("SP.POP.TOTL")
    gdp_series = world_bank("NY.GDP.MKTP.CD")
    area_series = world_bank("AG.LND.TOTL.K2")

    def own_unit(key: str) -> str:
        return OWN_UNIT.get(key, key)

    def wb_iso(key: str) -> str:
        p = unit_props[own_unit(key)]
        iso = p["ISO_A3_EH"] if p["ISO_A3_EH"] != "-99" else p["ADM0_A3"]
        return {"KOS": "XKX", "PSX": "PSE", "SDS": "SSD"}.get(iso, iso)

    def figures_for(key: str) -> dict:
        iso, props, manual = wb_iso(key), unit_props[own_unit(key)], MANUAL_STATS.get(key, {})

        def latest(name: str, series: dict, ne_value: float, ne_year: int) -> dict | None:
            if name in manual:
                return figure(*manual[name])
            if iso in series:
                return figure(series[iso][-1][1], series[iso][-1][0])
            return figure(ne_value, ne_year, "Natural Earth") if ne_value > 0 else None

        population = latest("population", population_series, props["POP_EST"], props["POP_YEAR"])
        assert population, f"{key} has no population"
        gdp = latest("gdp", gdp_series, props["GDP_MD"] * 1e6, props["GDP_YEAR"])
        # Per capita in the GDP figure's own year, with that year's population where there is one.
        per_capita = None
        if gdp:
            then = dict(population_series.get(iso, [])).get(gdp["year"], population["value"])
            per_capita = figure(gdp["value"] / then, gdp["year"])
        if "area" in manual:
            area = figure(*manual["area"])
        elif iso in area_series:
            area = figure(area_series[iso][-1][1], area_series[iso][-1][0])
        else:
            area = figure(feature_area(unit_geometry[own_unit(key)]), None, "Natural Earth")
        return {"population": population, "gdp": gdp, "gdpPerCapita": per_capita, "area": area}

    figures = {key: figures_for(key) for key in sorted(members)}
    for key, f in figures.items():
        for field, value in f.items():
            if value is None or value.get("source"):
                print(f"  {key} {field}: {value}")

    # --- Rasterize provinces: an id map of admin-1 units.
    a1_units = []
    for f in admin1:
        p = f["properties"]
        key = unit_country.get(p["adm0_a3"])
        if key is None:
            continue
        a1_units.append({"feature": f, "country": key, "lat": p["latitude"], "lon": p["longitude"]})
    print(f"{len(a1_units)} provinces")

    # A country smaller than a texel can't fill one, so it mustn't take one from a neighbour.
    # It goes first and anything else may draw over it, which leaves the islands theirs. After
    # that the largest provinces go first, so an enclave lands on the country around it.
    def too_small(key: str) -> bool:
        p = unit_props[own_unit(key)]
        return sum(feature_area(unit_geometry[u]) for u in members[key]) < texel_area(p["LABEL_Y"])

    small = {key for key in members if too_small(key)}
    print("Smaller than a texel:", sorted(small))
    order = sorted(range(len(a1_units)), key=lambda i: (a1_units[i]["country"] not in small, -feature_area(a1_units[i]["feature"]["geometry"])))
    a1_img = Image.new("I", (W, H), 0)
    draw = ImageDraw.Draw(a1_img)
    for i in order:
        draw_feature(draw, a1_units[i]["feature"]["geometry"], i + 1)
    a1 = np.array(a1_img, dtype=np.int32)

    def lookup(raster: np.ndarray, lat: float, lon: float, search: int = 3) -> int:
        x, y = int(lon_to_x(lon)) % W, min(H - 1, max(0, int(lat_to_y(lat))))
        if raster[y, x]:
            return int(raster[y, x])
        for r in range(1, search + 1):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    yy, xx = y + dy, (x + dx) % W
                    if 0 <= yy < H and raster[yy, xx]:
                        return int(raster[yy, xx])
        return 0

    # Province population from city populations, which tracks real distribution far
    # better than area (think Siberia vs Moscow).
    a1_pop = np.zeros(len(a1_units) + 1)
    for pl in places:
        p = pl["properties"]
        idx = lookup(a1, p["latitude"], p["longitude"])
        if idx:
            a1_pop[idx] += p["pop_max"] or 0
    pixel_count = np.bincount(a1.ravel(), minlength=len(a1_units) + 1)
    # Area of each pixel in km², which shrinks with cos(latitude).
    row_lat = 90.0 - (np.arange(H) + 0.5) * 180.0 / H
    px_km2 = (360.0 / W * 111.32) * (180.0 / H * 110.57) * np.cos(np.radians(row_lat))
    a1_area = np.bincount(a1.ravel(), weights=np.repeat(px_km2, W), minlength=len(a1_units) + 1)

    # --- How many regions each country gets: grows with population and land area.
    by_country: dict[str, list[int]] = defaultdict(list)
    for i, u in enumerate(a1_units):
        by_country[u["country"]].append(i)
    missing = set(members) - set(by_country)
    assert not missing, f"no provinces for {sorted(missing)}"
    area_px = {k: sum(pixel_count[i + 1] for i in idx) for k, idx in by_country.items()}

    def wanted(scale: float) -> dict[str, int]:
        out = {}
        for k, idx in by_country.items():
            raw = scale * ((figures[k]["population"]["value"] / 1e6) ** 0.45 + 0.02 * area_px[k] ** 0.6)
            out[k] = int(clamp(round(raw), 1, min(14, len(idx))))
        return out

    lo, hi = 0.01, 2.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if sum(wanted(mid).values()) < TARGET_REGIONS:
            lo = mid
        else:
            hi = mid
    k_by_country = wanted(lo)

    # --- Capital cities.
    capitals: dict[str, dict] = dict(MANUAL_CAPITALS)
    for pl in places:
        p = pl["properties"]
        unit = PLACE_UNITS.get(p["adm0_a3"], p["adm0_a3"])
        key = unit_country.get(unit)
        if key is None or unit != own_unit(key) or (p["featurecla"] != "Admin-0 capital" and p["adm0cap"] != 1):
            continue
        if key not in capitals or (p["pop_max"] or 0) > capitals[key]["pop"]:
            capitals[key] = {"name": p["name"], "lat": p["latitude"], "lon": p["longitude"], "pop": p["pop_max"] or 0}
    # Named overrides may not be flagged as national capitals in Natural Earth (e.g. Ramallah).
    for key, wanted_name in CAPITAL_OVERRIDES.items():
        found = [pl["properties"] for pl in places if pl["properties"]["name"] == wanted_name and unit_country.get(pl["properties"]["adm0_a3"]) == key]
        assert found, f"{wanted_name} is not a place in {key}"
        capitals[key] = {"name": wanted_name, "lat": found[0]["latitude"], "lon": found[0]["longitude"], "pop": found[0]["pop_max"] or 0}
    missing = set(members) - set(capitals)
    assert not missing, f"no capital for {sorted(missing)}"

    # --- Cluster provinces into regions (weighted k-means on the sphere, deterministic init).
    region_of_a1 = np.zeros(len(a1_units) + 1, dtype=np.int32)
    regions = []
    for key in sorted(by_country):
        idx = by_country[key]
        k = k_by_country[key]
        pts = np.array([unit_vector(a1_units[i]["lat"], a1_units[i]["lon"]) for i in idx])
        weights = np.array([a1_pop[i + 1] + 2e4 + 50.0 * pixel_count[i + 1] for i in idx])
        centers = [pts[int(np.argmax(weights))]]
        while len(centers) < k:
            d = np.min([np.linalg.norm(pts - c, axis=1) for c in centers], axis=0)
            centers.append(pts[int(np.argmax(d * np.sqrt(weights)))])
        centers = np.array(centers)
        for _ in range(30):
            assign = np.argmin(((pts[:, None, :] - centers[None, :, :]) ** 2).sum(-1), axis=1)
            for c in range(k):
                m = assign == c
                if m.any():
                    centers[c] = (pts[m] * weights[m, None]).sum(0) / weights[m].sum()
        for c in range(k):
            members_idx = [idx[j] for j in range(len(idx)) if assign[j] == c]
            px = int(sum(pixel_count[i + 1] for i in members_idx))
            # A cluster with no texels can never be seen.
            if not px:
                continue
            for i in members_idx:
                region_of_a1[i + 1] = len(regions) + 1
            regions.append({"country": key, "px": px,
                            "cityPop": float(sum(a1_pop[i + 1] for i in members_idx)),
                            "area": float(sum(a1_area[i + 1] for i in members_idx))})

    rid_map = region_of_a1[a1]  # 0 = sea, else region index + 1

    # --- Region populations: split each country's population by city population, with a
    # floor from area so empty regions are not literally empty.
    for key in by_country:
        rs = [r for r in regions if r["country"] == key]
        weights = [r["cityPop"] + 50.0 * r["px"] for r in rs]
        total = sum(weights) or 1
        for r, w in zip(rs, weights):
            r["population"] = figures[key]["population"]["value"] * w / total

    countries_out = []
    for key in sorted(members):
        props = unit_props[own_unit(key)]
        c = capitals[key]
        countries_out.append({
            "id": key.lower(),
            "name": NAME_OVERRIDES.get(key, props["NAME_LONG"]),
            "capital": {"name": CAPITAL_NAMES.get(key, c["name"]), "lat": round(c["lat"], 2), "lon": round(c["lon"], 2)},
            **figures[key],
        })
    regions_out = [{"countryId": r["country"].lower(), "population": round(r["population"]), "areaKm2": round(r["area"])} for r in regions]

    CONTENT.mkdir(parents=True, exist_ok=True)
    (CONTENT / "countries.json").write_text(json.dumps(countries_out, indent=1, ensure_ascii=False) + "\n")
    (CONTENT / "regions.json").write_text(json.dumps(regions_out, indent=1, ensure_ascii=False) + "\n")

    held = {r["country"] for r in regions}
    print("Reached only through search:", sorted(set(members) - held))

    # --- Region id map, borders and art.
    MAP_OUT.mkdir(parents=True, exist_ok=True)
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    rgb[..., 0] = rid_map & 0xFF
    rgb[..., 1] = (rid_map >> 8) & 0xFF
    Image.fromarray(rgb, "RGB").save(MAP_OUT / "regions.png", optimize=True)

    index_of = {key: i + 1 for i, key in enumerate(sorted(members))}
    country_of = np.array([0] + [index_of[r["country"]] for r in regions], dtype=np.int32)
    country_map = country_of[rid_map]
    borders = np.zeros((H, W, 4), dtype=np.uint8)
    for shift in ((0, 1), (1, 0)):
        other = np.roll(country_map, -shift[1], axis=1) if shift[1] else np.vstack([country_map[1:], country_map[-1:]])
        borders[(country_map > 0) & (other > 0) & (country_map != other)] = (255, 255, 255, 230)
    Image.fromarray(borders, "RGBA").save(MAP_OUT / "borders.png", optimize=True)

    # Antarctica belongs to no country (no regions), but the art still shows it.
    ata_img = Image.new("L", (W, H), 0)
    ata_draw = ImageDraw.Draw(ata_img)
    for f in admin0:
        if f["properties"]["ADM0_A3"] == "ATA":
            draw_feature(ata_draw, f["geometry"], 1)
    make_art((rid_map > 0) | (np.asarray(ata_img) > 0))
    print(f"Wrote {len(countries_out)} countries and {len(regions_out)} regions")


BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16 - 0.5

# Hand-picked land palette: forest, grassland, steppe, desert, rock and snow ramps.
LAND_PALETTE = np.array([
    (22, 58, 38), (30, 78, 44), (44, 102, 52), (66, 128, 58),      # forest → meadow
    (98, 146, 66), (132, 164, 78), (164, 176, 96), (124, 116, 70),  # grass, steppe, olive
    (196, 178, 116), (216, 196, 138), (232, 214, 160), (186, 140, 88),  # savanna, sand, dune
    (150, 102, 66), (110, 82, 64), (86, 76, 72), (128, 122, 116),   # rust, brown, rock
    (170, 168, 164), (206, 216, 226), (236, 242, 248), (255, 255, 255),  # scree, ice, snow
], dtype=np.float32)

# Three ocean bands from the coast outwards, plus a lighter shelf band.
SEA_BANDS = np.array([(58, 120, 178), (40, 92, 152), (28, 64, 120), (20, 44, 92)], dtype=np.float32)


def make_art(land: np.ndarray) -> None:
    """Turns Natural Earth's shaded relief into pixel art: downsample, stretch contrast,
    map onto a hand-picked palette with ordered dithering, band the ocean, outline coasts."""
    Image.MAX_IMAGE_PIXELS = None
    src = Image.open(CACHE / "ne1/NE1_50M_SR_W/NE1_50M_SR_W.tif").convert("RGB")
    img = np.asarray(src.resize((W, H), Image.Resampling.BOX), dtype=np.float32)

    raw = img.copy()
    # Stretch brightness over the land's 2nd–98th percentile (same for every channel, so
    # hues survive) and boost saturation, so the pale source raster separates into biomes.
    lum = img.mean(axis=2)
    lo, hi = np.percentile(lum[land], (2, 98))
    img = (img - lo) / max(hi - lo, 1) * 235 + 10
    grey = img.mean(axis=2, keepdims=True)
    img = np.clip(grey + (img - grey) * 2.2, 0, 255)
    # Relief shading: emphasise the raster's hillshade by contrasting with a blurred copy.
    blur = np.asarray(Image.fromarray(img.astype(np.uint8)).filter(ImageFilterGaussian(3)), dtype=np.float32)
    img = np.clip(img + (img - blur) * 1.2, 0, 255)

    tile = np.tile(BAYER4, (H // 4, W // 4))[..., None]
    dithered = img + tile * 28
    d = ((dithered[..., None, :] - LAND_PALETTE[None, None, :, :]) ** 2).sum(-1)
    # Snow and ice only where the source is genuinely white-grey (glaciers, high peaks) or
    # near the poles; bright desert sand must not turn into snow.
    raw_sat = raw.max(axis=2) - raw.min(axis=2)
    lat = (90.0 - (np.arange(H) + 0.5) * 180.0 / H)[:, None]
    # Below 40° latitude only rugged terrain (high local contrast in the hillshade) can be
    # snow-capped, which keeps salt flats in the Sahara from reading as snow.
    raw_lum = raw.mean(axis=2)
    local_mean = np.asarray(Image.fromarray(raw_lum.astype(np.uint8)).filter(ImageFilterGaussian(4)), dtype=np.float32)
    local_sq = np.asarray(Image.fromarray(np.clip((raw_lum - local_mean) ** 2, 0, 255).astype(np.uint8)).filter(ImageFilterGaussian(4)), dtype=np.float32)
    rugged = local_sq > 40
    snowy = ((raw_sat < 18) & (raw_lum > 200) & ((np.abs(lat) > 40) | rugged)) | (np.abs(lat) > 62)
    d[..., 17:] = np.where(snowy[..., None], d[..., 17:], np.inf)
    out = LAND_PALETTE[np.argmin(d, axis=-1)]

    # Ocean: distance bands with dithered edges between them.
    dist = coast_distance(land, steps=24) + np.tile(BAYER4, (H // 4, W // 4)) * 3
    band = np.digitize(dist, [3, 8, 16])
    out = np.where(land[..., None], out, SEA_BANDS[band])

    # Dark 1-px outline on the land side of every coast.
    shore = land & ~(shift_rows(land, 1) & shift_rows(land, -1) & np.roll(land, 1, 1) & np.roll(land, -1, 1))
    out[shore] = out[shore] * 0.55
    Image.fromarray(out.astype(np.uint8), "RGB").save(MAP_OUT / "earth.png", optimize=True)


def shift_rows(mask: np.ndarray, n: int) -> np.ndarray:
    """A mask moved down (n = 1) or up (n = -1) a row. Columns wrap at the antimeridian, but
    rows don't: Antarctica at the bottom edge isn't next to the Arctic at the top."""
    return np.vstack([mask[:1], mask[:-1]]) if n > 0 else np.vstack([mask[1:], mask[-1:]])


def coast_distance(land: np.ndarray, steps: int) -> np.ndarray:
    """Approximate distance from land in pixels. Alternating 4- and 8-neighbour growth gives
    octagonal rings instead of diamonds."""
    dist = np.where(land, 0, steps).astype(np.float32)
    frontier = land.copy()
    for d in range(1, steps):
        grown = frontier | shift_rows(frontier, 1) | shift_rows(frontier, -1) | np.roll(frontier, 1, 1) | np.roll(frontier, -1, 1)
        if d % 2 == 0:
            diag = shift_rows(frontier, 1)
            grown |= np.roll(diag, 1, 1) | np.roll(diag, -1, 1)
            diag = shift_rows(frontier, -1)
            grown |= np.roll(diag, 1, 1) | np.roll(diag, -1, 1)
        newly = grown & ~frontier
        dist[newly] = d
        frontier = grown
    return dist


if __name__ == "__main__":
    main()
