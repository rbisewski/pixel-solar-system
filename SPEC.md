# Pixel Solar System: Product & Implementation Spec

**Status:** Draft v0.2 · **Date:** 2026-10-31 · **License:** MIT

> A web app for exploring the Solar System in pixel art. Zoom from a globe of the Earth with selectable countries out past the planets, down to the moons, dwarf planets, asteroids and comets, and run the clock to watch them move.

This spec describes the app as built. Deployment and a check in real Safari remain with the project owner.

---

## 1. Goals

1. **Beautiful pixel art.** Every body is drawn as pixel art with a limited palette, whatever the zoom level.
2. **Real where we can be.** Orbits, sizes and surface maps come from published sources, and the app says clearly when art is illustrative rather than measured.
3. **One continuous space.** There are no separate screens: a single zoom carries the camera from a country on the Earth to the whole Solar System.
4. **Open and instant.** It is a static web app with no account, install or backend.

### Out of scope
- Accounts, a backend and any native or desktop packaging. This is a web app only.
- Audio.
- Precision ephemerides. Positions are good for exploring, not for navigation or observation planning (section 4.3).
- Spacecraft, constellations and anything beyond the Solar System, other than the background stars.

---

## 2. Features

### 2.1 System View
- The Sun and every body on its orbit, to scale in AU, with the bodies themselves at a readable minimum on-screen size and at their true size once that is larger.
- The app opens here, framed on the inner Solar System. There is no title screen.
- Clicking a body focuses it: the camera follows it along its orbit and its panel opens.
- Moons appear once their orbits are wide enough on screen to tell apart from their planet.
- Orbits are always drawn for the major bodies. A small body's orbit and name show only while it is selected, to keep the view uncluttered.
- Labels and hover tooltips.

### 2.2 Bodies
All 488 bodies: the Sun, 8 planets, 19 major moons, 125 small moons, 47 dwarf planets and large trans-Neptunian objects, 269 asteroids, 16 comets and 3 interstellar objects.

**Interstellar objects:** 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS follow hyperbolas, with no orbit line, even when selected. Each shows while within 130 AU of the Sun, on its way in and on its way out. Outside that it is hidden, unless it is focused, so that the camera is never left on nothing. Their panels leave out what only a closed orbit has: period, mean speed, semi-major axis and launch window.

### 2.3 Zoom and close-up art
- Any mapped body can be zoomed down to 1.35 radii, where it becomes a turning, Sun-lit pixel globe of up to 512 art pixels across.
- Bodies turn on their published rotational elements, and tidally locked moons keep their near sides towards their planets.
- Special cases:
  - **Shapes:** irregular bodies are ray-cast from relief maps, and Haumea, Phobos and Deimos are drawn as ellipsoids.
  - **Rings:** Saturn, Uranus, Neptune, Haumea and Chariklo, with Saturn's shadow on its rings and theirs on it.
  - **Atmospheres:** Venus's and Titan's.
  - **Comets:** far away, a sprite with tails. Close up, a nucleus with a coma and jets, with activity depending on distance from the Sun.
  - **The Sun:** granulation, sunspots following the 11-year cycle and differential rotation, flares and prominences.
- Maps load on demand. Only the planets and great moons stay resident, along with the 32 most recently used others.

### 2.4 Earth globe
- A pixel-art globe with a moving day/night terminator, pixel city lights, a thin glowing atmosphere and drifting pixel clouds.
- Zooming out carries seamlessly into the System View at the same distance and angle, and scrolling back in on the Earth, double-clicking it or pressing Return to Earth hands back.
- Hovering highlights a country, and clicking selects it and opens its panel.

### 2.5 Countries
- The country panel shows the flag, name, capital, population, GDP, GDP per capita and land area, each with the year of its figure.
- Figures are the latest actual values from the sources, not projections.
- **Country list:** every sovereign country in Natural Earth, each as itself, for 197 in all.
  - Disputed areas follow de facto administration, as listed in `docs/data-sources.md`. Kosovo, Palestine and Taiwan are separate entries.
- A country too small to fill a texel on the 2048 × 1024 map is reached through search (section 2.8), which turns the globe to its capital.
- **Regions are internal.** Sub-national clusters only drive city-light density. The user only ever sees and selects countries.

### 2.6 Clock
- The clock starts at the current real date and time on load and is shown in UTC.
- Controls: pause, a live rate of 1 second per second, and faster rates of 1 hour, 1 day, 1 week, 1 month and 1 year per second. A "Now" button returns to the current moment, and a date picker jumps to any date from 1900 to 2100.
- Space pauses and resumes, and + and − change the rate.
- The clock is a small UI-side module driven by the frame loop.
- Everything follows one clock: positions, rotations, the terminator, sunspots and comet activity.
- Star streaking, and hiding other objects while the clock runs fast, are settings, both on by default as a guard against motion sickness.

### 2.7 Body panel
- Shows a live pixel portrait, class, name, parent, surface gravity, diameter, mass, orbital period, orbital speed, eccentricity, inclination, escape velocity, current distance from the Earth with light delay, and a list of moons with click-to-focus.
- The next Hohmann launch window from the Earth, labelled as an estimate.
- An imagery label on every body, because many surfaces are invented and would otherwise look just like spacecraft maps. It has three values, recorded per body at build time:
  - *Spacecraft map*: from a mission's imagery.
  - *Measured shape, illustrative surface*: real shape model, invented colouring.
  - *Illustrative*: no surface data exists, and the art is an artist's impression.
- A label on any estimated figure, such as a mass inferred from diameter.

### 2.8 Search
A single search box finds bodies and countries by name or designation and flies to the result. Most of the small bodies are hard to click and some countries cannot be clicked at all, so this is required rather than a nicety.

### 2.9 About and attribution
A panel lists the data and imagery sources with their licenses and credits. World Bank figures are CC BY 4.0, which requires this. It also explains the imagery labels and the limits of position accuracy.

### 2.10 Settings and accessibility
- Settings: hide objects while running, blur stars, and a UI scale from 75% to 200%.
- Honour `prefers-reduced-motion` by starting paused with star streaking off.
- Show a clear message when WebGL is unavailable.
- Desktop browsers are the primary target. Phones are supported, with touch orbit and pinch zoom and a panel that fits the screen.

---

## 3. Visual direction

- **Pixel art in the world:** point-filtered maps at limited palettes with ordered dithering, stepped lighting and phases from the Sun's real direction.
- **Clean UI over it:** translucent slate panels with thin borders, the Exo 2 font and Lucide icons, with a small clock bar, a search box and the panels above.

---

## 4. Architecture

### 4.1 Stack
Three.js, TypeScript, Svelte 5 and Vite, built as a **static site** with relative asset paths, which any plain file host can serve. Hosting and deployment are handled by the project owner. pnpm and Vitest for packages and tests, and Python with numpy and Pillow for the offline data tools.

### 4.2 Layout

| Path | What it is |
|---|---|
| `src/astro/` | Orbits, time and body-type definitions: pure TypeScript with no DOM. |
| `src/content/` | `solarSystem.json`, `countries.json`, `regions.json` and the code that loads them. |
| `src/app/solar/` | System View and body art. |
| `src/app/globe/` | Earth globe. |
| `src/app/components/` | Svelte UI: views, panels, clock, search, settings, about. |
| `src/app/clock.svelte.ts` | The clock, the single time source. |
| `src/app/ui.svelte.ts` | What the user has open: view, selection and settings. |
| `tools/data/` | Offline generators and fetchers. |
| `public/map/` | Generated maps. |
| `docs/data-sources.md` | Source, license and method for every dataset. |

There is no Web Worker: everything runs on the main thread.

### 4.3 Position accuracy
Planets follow JPL's *Keplerian Elements for Approximate Positions*, including its secular rates. The interstellar objects move on hyperbolas from JPL's elements. Every other body moves on a fixed Kepler ellipse from its epoch, so small bodies perturbed by planets, comets especially, get less accurate far from their epoch. This is acceptable for the app and is disclosed in the About panel.

**Target:** each planet's heliocentric ecliptic longitude is within 1° of JPL Horizons from 1950 to 2050, checked by tests against stored Horizons values.

### 4.4 Performance
There is no formal budget. `public/map` is 84 MB in 887 files, 52 MB of it relief maps, and maps load on demand (section 2.3). These choices keep phones smooth:

- **Render scale:** views draw at up to 2 device pixels per CSS pixel, or 1.25 on a touch screen (`renderScale.ts`).
- **Body art:** 2D canvases are created with `willReadFrequently`, so redrawing them doesn't load the GPU.
- **Redraw limit:** a frame spends at most 4 ms relighting bodies that already have art, taking the largest and longest-waiting first. The focused body and any body with no current art are drawn immediately.
- **Layout reads:** the System View keeps its size from the last resize rather than reading it each frame.
- **Hidden work:** the Earth's disc isn't redrawn while the globe covers it.

---

## 5. Data

### 5.1 Provenance
Everything shipped comes from the published sources in `docs/data-sources.md`, or is made up and labelled as such. A rebuild needs only those sources. Where nothing is measured, values are estimated and marked (section 5.2), and surfaces are illustrative (section 2.7).

### 5.2 Solar System data
`tools/data/bodies.json` is the project's hand-kept list of bodies. Each row holds the id, what the body is drawn as, its data source and designation, map file and imagery label, and a display name where JPL's isn't the one to show. Ids are internal. `build_solar.py` resolves each row:

| Data | Source |
|---|---|
| Planets' orbits and secular rates | JPL *Keplerian Elements for Approximate Positions* |
| Planets' and dwarf planets' physical data | JPL *Planetary Physical Parameters* |
| Moons' orbits | JPL planetary satellite mean elements (`jpl_satellites.json`, from `build_satellites.py`) |
| Moons' sizes and masses | JPL Horizons, where it gives them |
| Asteroids, dwarf planets, comets and interstellar objects: orbits, diameter, albedo, spectral type and GM where known | JPL Small-Body Database API |
| Gaps in the above | `solar_overrides.json`, with each entry naming its published source |
| Rotational elements | IAU WGCCRE reports (in `bodyFrames.ts`) |

- **Names:** the IAU's name, otherwise the provisional designation.
- **Missing values:** a mass or size that no source gives is estimated, and marked as estimated in the data and the panel.
- **Surface tones:** spectral type and albedo where known, otherwise a neutral tone, labelled *Illustrative*.
- **Validation:** the build fails on a body with no source, or a moon whose parent is missing.

### 5.3 Surface maps
Maps come from USGS, NASA, JPL and DLR sources, recorded in `docs/data-sources.md`, or are procedurally generated. `build_body_maps.py` builds them from a download cache of roughly 4.2 GB. A per-source review of image licences is deferred and does not block v1. The sources are credited in the docs and About panel.

### 5.4 Earth data
| Data | Source | License |
|---|---|---|
| Borders, provinces, populated places, shaded relief | Natural Earth | Public domain |
| Population, GDP | World Bank Open Data | CC BY 4.0 |
| Taiwan, North Korea and Eritrea figures, and Vatican City's | Cited figures, as `MANUAL_STATS` in `build_world.py` | Cited |
| Land area | World Bank, or computed from Natural Earth where missing | CC BY 4.0 / public domain |
| Flags | `flag-icons` package | MIT |

---

## 6. Testing

- **Unit (Vitest):** orbit positions, clock rates and limits, search matching, body facts and panel formatting.
- **Accuracy:** the Horizons comparison in section 4.3.
- **Data validation:** in the build, as in section 5.2, and a test that every body's map file and imagery label exists.
- **Manual:** the zoom from a country out to the outer system and back, selecting a small country, selecting a small body, and running the clock at every rate.

---

## 7. Definition of done (v1)

1. `pnpm build` produces a static site that runs from a plain file host, with no server code.
2. Every feature in section 2 works in current Chrome, Firefox and Safari.
3. The check in section 4.3 passes.
4. Every body has a source and an imagery label, and the About panel credits every dataset.
5. `pnpm test` and `pnpm typecheck` pass.

---

## 8. Deferred

- **Image licences:** a per-source review (section 5.3).

---

## 9. Decision log

| ID | Decision |
|---|---|
| D1 | A static web app with no backend (4.1). |
| D2 | Everything shipped comes from published sources, or is made up and labelled, and a rebuild needs nothing else (5.1). |
| D3 | JPL sources come first, then the published literature (5.2). |
| D4 | Illustrative art is labelled as such in the app (2.7). |
| D5 | The clock starts at the real current time, and covers 1900–2100 (2.6). |
| D6 | The app opens on the System View (2.1). |
| D7 | Countries are the only selectable Earth unit. Regions are internal, and each sovereign country appears as itself (2.5). |
| D8 | Country figures are the latest actual values, not projections (2.5). |
| D9 | Search is part of v1 (2.8). |
| D10 | Planets get secular rates. Other bodies stay on fixed Kepler elements (4.3). |
| D11 | Hosting is any plain file host, handled by the project owner (4.1). |
| D12 | There is no formal performance budget (4.4). |
| D13 | The per-source image licence review is deferred (5.3). |
