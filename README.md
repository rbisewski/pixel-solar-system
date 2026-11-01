# Pixel Solar System

A web app for exploring the Solar System in pixel art. Zoom from a globe of the Earth with selectable countries out past the planets, down to the moons, dwarf planets, asteroids and comets, and run the clock to watch them move. The design is in [SPEC.md](SPEC.md).

## Using it

- **Move:** drag to orbit and scroll or pinch to zoom. In the Solar System, right-drag or drag with two fingers to pan, out to about 150 AU from the Sun; clicking a body comes back to it. Zooming out from the globe carries on into the Solar System, and zooming all the way in on the Earth, double-clicking it or pressing Return to Earth comes back.
- **Select:** click a body or a country to open its panel. The search box finds any body or country by name or designation, including those too small to click.
- **Clock:** Space pauses and resumes, and + and − change the rate. Click the date to jump to any day from 1900 to 2100, and Now returns to the present.
- **Settings:** interface size, and the motion options. The app starts paused, with star streaks off, if the browser asks for reduced motion.

Positions are for exploring, not for navigation or planning observations, and much of the surface art is illustrative. The app labels which, and its About panel explains the limits and credits the sources.

## Stack

Three.js, TypeScript, Svelte 5 and Vite.

| Path | What it is |
|---|---|
| `src/astro/` | Orbits and time: pure TypeScript with no DOM or Node dependencies (checked by `tsconfig.astro.json`). |
| `src/content/` | The bodies, countries and regions as JSON. |
| `src/app/` | Svelte UI, the Three.js globe and the Solar System view. |
| `tools/data/` | Fetches source data and generates the bodies, countries and maps. |
| `public/map/` | Generated maps. |
| `docs/data-sources.md` | Source, license and method for every dataset. |

## Commands

```sh
pnpm install
pnpm dev                 # browser at http://localhost:1420
pnpm test
pnpm typecheck
pnpm build               # static site in dist/
pnpm preview             # serves the build
```

`dist/` uses relative paths, so it can be hosted from any folder of a plain file host. It has to be served over HTTP, as browsers won't load it from `file://`.

## Rebuilding the data

The generated files are committed, so this is only needed to change them. It takes Python with numpy and Pillow, and about 4.2 GB of downloads kept in `tools/data/.cache`.

```sh
python3 -I tools/data/fetch.py
python3 -I tools/data/build_world.py     # the Earth
python3 -I tools/data/build_planets.py   # then the Solar System, in this order
python3 -I tools/data/build_satellites.py
python3 -I tools/data/build_small_bodies.py
python3 -I tools/data/build_solar.py
python3 -I tools/data/build_body_maps.py [body …]
```

## License

MIT, for the code. The data and imagery have their own terms: see `docs/data-sources.md`.
