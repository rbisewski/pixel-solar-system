<script lang="ts">
  // The Earth's globe, drawn over the Solar System view, which follows its camera. Hovering a
  // country lights it up and clicking selects it.
  import { utcDay } from "../../astro/time";
  import { content } from "../../content/index";
  import { clock } from "../clock.svelte";
  import { Globe } from "../globe/Globe";
  import { handoff } from "../solar/handoff";
  import { ui } from "../ui.svelte";

  let container: HTMLDivElement;
  let globe = $state<Globe | null>(null);
  /** Where the camera glides in to after flying home from the Solar System view, in Earth radii. */
  const GLIDE_TO = 3.3;
  let hovered = $state<number | null>(null);

  const regions = content.regions;
  const countries = new Map(content.countries.map((c) => [c.id, c]));

  /** The indices of a country's regions. */
  const regionsOf = (id: string) => regions.flatMap((r, i) => (r.countryId === id ? [i] : []));

  /** City lights: brighter where people are dense, dimmer where they are poor. */
  function lightDensity(region: (typeof regions)[number]): number {
    const country = countries.get(region.countryId)!;
    // 1 person/km² gives none, 1000/km² full density; GDP per capita of $20K+ lights fully.
    const perKm2 = region.population / Math.max(region.areaKm2, 1);
    const crowding = Math.min(1, Math.max(0, Math.log10(Math.max(perKm2, 1)) / 3));
    const wealth = Math.sqrt(Math.min(1, (country.gdpPerCapita?.value ?? 0) / 20000));
    return crowding * (0.15 + 0.85 * wealth);
  }

  /** Set when the browser can't give us WebGL (e.g. hardware acceleration is off). */
  let webglError = $state(false);

  $effect(() => {
    let g: Globe;
    try {
      g = new Globe(
        container,
        regions.length,
        (index) => (ui.selectedCountryId = index === null ? null : regions[index]!.countryId),
        (index) => (hovered = index),
      );
      g.onFrame = (camera) => handoff.solar?.followGlobe(camera);
      g.onZoomOut = (direction, distance) => {
        hovered = null;
        handoff.direction.copy(direction);
        handoff.distance = distance;
        ui.view = "solar";
      };
      g.setLights(regions.map(lightDensity));
      handoff.globe = g;
    } catch (error) {
      console.error(error);
      webglError = true;
      return;
    }
    globe = g;
    return () => {
      g.dispose();
      globe = handoff.globe = null;
    };
  });

  // The globe rests while the Solar System view has the camera, and takes it back where that view left it.
  let shownView: typeof ui.view = "earth";
  $effect(() => {
    if (!globe) return;
    const earth = ui.view === "earth";
    if (earth && shownView !== "earth") globe.setCamera(handoff.direction, handoff.distance, handoff.glide ? GLIDE_TO : undefined);
    shownView = ui.view;
    globe.setActive(earth);
  });

  // A country found by search: the globe turns to its capital once it has the camera.
  $effect(() => {
    const id = ui.countryToFace;
    if (!globe || !id || ui.view !== "earth") return;
    globe.turnTo(countries.get(id)!.capital, GLIDE_TO);
    ui.countryToFace = null;
  });

  // The sun follows the clock.
  $effect(() => {
    const { dayOfYear, dayFraction } = utcDay(clock.ms);
    globe?.setTime(dayOfYear, dayFraction);
  });

  // The country under the mouse glows to show it can be clicked.
  $effect(() => {
    globe?.setHover(hovered === null ? [] : regionsOf(regions[hovered]!.countryId));
  });

  // The selected country is tinted.
  $effect(() => {
    const selected = ui.selectedCountryId;
    globe?.setTints(regions.map((r) => (r.countryId === selected ? { color: "#ffffff", strength: 0.3 } : { color: null, strength: 0 })));
  });
</script>

<div class="globe" class:resting={ui.view !== "earth"} bind:this={container}></div>
{#if webglError}
  <div class="webgl-error panel">
    <strong>The globe needs WebGL, which this browser isn't providing.</strong>
    <span class="muted">Turn on hardware acceleration in the browser settings, or restart the browser if its graphics process has crashed (see chrome://gpu or brave://gpu).</span>
  </div>
{/if}
{#if hovered !== null}
  <div class="hover panel">{countries.get(regions[hovered]!.countryId)!.name}</div>
{/if}

<style>
  .globe {
    position: absolute;
    inset: 0;
  }
  /* The Solar System view beneath has the camera, and the mouse. */
  .globe.resting {
    pointer-events: none;
  }
  .webgl-error {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 420px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }
  .hover {
    position: absolute;
    left: 50%;
    bottom: 12px;
    z-index: 6;
    transform: translateX(-50%) scale(var(--ui-scale));
    transform-origin: bottom center;
    padding: 3px 10px;
    pointer-events: none;
  }
</style>
