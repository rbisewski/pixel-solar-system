<script lang="ts">
  // About: what the labels mean, how far to trust the positions, and the sources and credits.
  import { ui } from "../ui.svelte";
  import Icon from "../ui/Icon.svelte";

  const close = () => (ui.aboutOpen = false);

  const SOURCES = [
    ["Planets' orbits", "JPL, Keplerian Elements for Approximate Positions", "https://ssd.jpl.nasa.gov/planets/approx_pos.html", "NASA/JPL"],
    ["Planets' sizes and masses", "JPL, Planetary Physical Parameters", "https://ssd.jpl.nasa.gov/planets/phys_par.html", "NASA/JPL"],
    ["Moons' orbits", "JPL, Planetary Satellite Mean Elements", "https://ssd.jpl.nasa.gov/sats/elem/", "NASA/JPL"],
    ["Moons' sizes and masses", "JPL Horizons", "https://ssd.jpl.nasa.gov/horizons/", "NASA/JPL"],
    ["Asteroids, comets, dwarf planets", "JPL Small-Body Database", "https://ssd-api.jpl.nasa.gov/doc/sbdb.html", "NASA/JPL"],
    ["Rotation", "IAU Working Group on Cartographic Coordinates and Rotational Elements (Archinal et al. 2018)", "https://doi.org/10.1007/s10569-017-9805-5", "Published report"],
    ["Surface maps", "USGS Astrogeology, from NASA missions and DLR", "https://astrogeology.usgs.gov/search", "Public domain"],
    ["The Moon's map", "NASA SVS, CGI Moon Kit (LRO)", "https://svs.gsfc.nasa.gov/4720", "Public domain"],
    ["Mars's relief", "NASA PDS Geosciences (MGS MOLA)", "https://pds-geosciences.wustl.edu/", "Public domain"],
    ["Shape models", "NASA PDS Small Bodies Node", "https://sbn.psi.edu/pds/shape-models/", "Public domain"],
    ["Earth's borders, relief and cities", "Natural Earth", "https://www.naturalearthdata.com/", "Public domain"],
    ["Population, GDP, land area", "World Bank Open Data", "https://data.worldbank.org/", "CC BY 4.0"],
    ["Flags", "flag-icons", "https://github.com/lipis/flag-icons", "MIT"],
    ["Font", "Exo 2", "https://fonts.google.com/specimen/Exo+2", "SIL OFL 1.1"],
    ["Icons", "Lucide", "https://lucide.dev/", "ISC"],
  ];
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="overlay">
  <section class="sheet panel" aria-label="About and sources">
    <header>
      <h2>About and Sources</h2>
      <button class="icon-button flat" title="Close" onclick={close}><Icon name="close" size={16} /></button>
    </header>
    <div class="body">
      <p>Pixel Solar System is for exploring, not for navigation or planning observations. Art aside, what it shows comes from the published sources below.</p>

      <h3>Imagery labels</h3>
      <dl>
        <dt>Spacecraft map</dt><dd>The surface comes from a mission's imagery. Parts the mission never saw may be filled in from its surroundings.</dd>
        <dt>Measured shape, illustrative surface</dt><dd>The shape is a real model, and the colouring is invented.</dd>
        <dt>Illustrative</dt><dd>No surface data exists, so the art is an artist's impression, after the body's size, albedo and spectral type where they are known.</dd>
      </dl>

      <h3>Estimates</h3>
      <p>Most small bodies have no measured mass, and many no measured size. A size is then estimated from brightness, and a mass from size at an assumed density, and both are marked as estimates. So are the gravity and escape velocity worked out from them. Launch windows are simple estimates for circular, flat orbits.</p>

      <h3>Position accuracy</h3>
      <p>Planets follow JPL's approximate elements, within 1° of JPL Horizons from 1950 to 2050, and drift further towards 1900 and 2100. Every other body moves on a fixed ellipse with no perturbations, so it drifts as the date leaves its orbit's epoch. Comets and fast inner moons drift the most.</p>

      <h3>Country figures</h3>
      <p>Figures are the latest actual values, each with its year, so years differ between countries. The panel names any source other than the World Bank. Disputed areas follow de facto administration, which implies no position on them.</p>

      <h3>Sources</h3>
      <table>
        <tbody>
          {#each SOURCES as [what, source, url, license] (what)}
            <tr>
              <td class="muted">{what}</td>
              <td><a href={url} target="_blank" rel="noreferrer">{source}</a></td>
              <td class="muted">{license}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted">Figures for countries the World Bank doesn't cover come from the Bank of Korea, the UN and the IMF, and are cited in their panels. World Bank data is used under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>; it is unchanged but for taking each country's latest value and dividing GDP by population. NASA and USGS do not endorse this app. Each map's full method is in the project's <code>docs/data-sources.md</code>.</p>
    </div>
  </section>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 6px;
    z-index: 61;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    pointer-events: none;
  }
  .sheet {
    display: flex;
    flex-direction: column;
    width: min(640px, 100%);
    max-height: 100%;
    background: var(--panel-solid);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
  }
  header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: var(--header);
    border-bottom: 1px solid var(--border);
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 1em;
  }
  .flat {
    background: transparent;
    border-color: transparent;
  }
  .body {
    padding: 4px 12px 12px;
    overflow-y: auto;
  }
  h3 {
    margin: 12px 0 4px;
    font-size: 0.95em;
    font-weight: 400;
    color: var(--header-text);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  p {
    margin: 6px 0;
  }
  dt {
    color: var(--accent);
  }
  dd {
    margin: 0 0 6px;
  }
  dl {
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }
  td {
    padding: 2px 8px 2px 0;
    border-top: 1px solid var(--border-soft);
    vertical-align: top;
  }
  a {
    color: var(--accent);
  }
</style>
