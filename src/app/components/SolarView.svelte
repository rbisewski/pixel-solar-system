<script lang="ts">
  // Solar System view (src/app/solar/SolarSystem.ts), always beneath the see-through globe:
  // while the globe has the camera it draws from the globe's (handoff.ts), and zooming out past
  // the globe it takes over from there, so the zoom carries on with no change of view. Scrolling
  // all the way back in on the Earth hands back; double-clicking it or the button flies home
  // first. Clicking a body opens its Celestial Body panel, and choosing one there swings to it.
  import { untrack } from "svelte";
  import * as THREE from "three";
  import { FAST_RATE, utcDay, yearsSinceJ2000 } from "../../astro/time";
  import { content } from "../../content/index";
  import { clock } from "../clock.svelte";
  import { sunDirection } from "../globe/Globe";
  import { handoff } from "../solar/handoff";
  import { SolarSystem } from "../solar/SolarSystem";
  import { ui } from "../ui.svelte";

  let container: HTMLDivElement;
  let solar = $state<SolarSystem | null>(null);
  /** Whether this view has the camera (rather than following the globe). */
  const shown = $derived(ui.view === "solar");
  /** The first time this view has the camera the app has just opened, rather than the globe handing over. */
  let opened = false;

  /** Julian years since J2000, and the Sun's direction in the globe's frame, at the clock's time. */
  function time(): [number, THREE.Vector3] {
    const { dayOfYear, dayFraction } = utcDay(clock.ms);
    return [yearsSinceJ2000(clock.ms), sunDirection(dayOfYear, dayFraction)];
  }

  function toEarth(direction: THREE.Vector3, distance: number, glide: boolean) {
    handoff.direction.copy(direction);
    handoff.distance = distance;
    handoff.glide = glide;
    ui.view = "earth";
  }

  $effect(() => {
    try {
      const view = new SolarSystem(container, content, toEarth);
      view.onSelectBody = (id) => (ui.selectedBodyId = id);
      untrack(() => view.setTime(...time()));
      solar = handoff.solar = view;
    } catch (error) {
      // The globe still works without the space beyond it.
      console.error(error);
    }
    return () => {
      solar?.dispose();
      solar = handoff.solar = null;
    };
  });

  // Taking the camera from the globe. Only on the change: the clock ticking mustn't put it back.
  $effect(() => {
    if (!shown || !solar) return;
    const view = solar;
    untrack(() => {
      if (opened) view.enterFromGlobe(handoff.direction, handoff.distance);
      else view.frameOverview();
      opened = true;
    });
  });

  // A body chosen in the Celestial Body panel (a moon in its list): the camera swings to it.
  // A small body's orbit shows while its panel is open.
  $effect(() => {
    const id = ui.selectedBodyId;
    const view = solar;
    untrack(() => {
      if (id && shown) view?.focus(id);
      view?.showOrbitOf(id);
    });
  });

  // The Hide Objects setting applies only while the clock runs fast.
  $effect(() => {
    solar?.setHideBackground(ui.settings.hideObjectsWhenUnpaused && clock.rate >= FAST_RATE);
  });

  $effect(() => {
    solar?.setBlurStars(ui.settings.blurStars);
  });

  // The bodies move with the clock.
  $effect(() => {
    solar?.setTime(...time());
  });

</script>

<div class="solar" bind:this={container}></div>
{#if shown}
  <button class="home" onclick={() => solar?.returnToEarth()}>Return to Earth</button>
{/if}

<style>
  .solar {
    position: absolute;
    inset: 0;
    background: #05060d;
  }
  .home {
    position: absolute;
    left: 10px;
    bottom: 10px;
    font-size: 0.85em;
    transform: scale(var(--ui-scale));
    transform-origin: bottom left;
  }
  .solar :global(canvas) {
    display: block;
  }
  .solar :global(.solar-labels) {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .solar :global(.solar-label) {
    position: absolute;
    top: 0;
    left: 0;
    color: #cfd9e2;
    font-size: 12px;
    white-space: nowrap;
    text-shadow: 0 0 3px #000, 0 0 3px #000;
  }
  .solar :global(.solar-label.planet),
  .solar :global(.solar-label.star) {
    font-size: 13px;
    color: #e4ecf2;
  }
  .solar :global(.solar-label.moon),
  .solar :global(.solar-label.dwarf) {
    color: #9fb0bf;
    font-size: 11px;
  }
  .solar :global(.solar-label.focused) {
    color: var(--accent);
  }
  .solar :global(.solar-tooltip) {
    position: absolute;
    top: 0;
    left: 0;
    padding: 2px 6px;
    border: 1px solid var(--border);
    background: var(--panel);
    font-size: 12px;
    pointer-events: none;
  }
</style>
