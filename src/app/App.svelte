<script lang="ts">
  // The Solar System view with the globe drawn over it, the clock bar along the top, and the
  // panel of whatever is selected at the upper left. The interface scales as a whole, so its
  // layout holds at any size.
  import AboutPanel from "./components/AboutPanel.svelte";
  import CelestialBodyPanel from "./components/CelestialBodyPanel.svelte";
  import ClockBar from "./components/ClockBar.svelte";
  import CountryPanel from "./components/CountryPanel.svelte";
  import GlobeView from "./components/GlobeView.svelte";
  import SettingsPanel from "./components/SettingsPanel.svelte";
  import SolarView from "./components/SolarView.svelte";
  import { ui } from "./ui.svelte";
</script>

<div class="layout" style:--ui-scale={ui.settings.uiScale}>
  <SolarView />
  <GlobeView />
  <div class="interface">
    <div class="top"><ClockBar /></div>
    <div class="below">
      {#if ui.view === "solar" && ui.selectedBodyId}
        <div class="selected"><CelestialBodyPanel /></div>
      {:else if ui.view === "earth" && ui.selectedCountryId}
        <div class="selected"><CountryPanel /></div>
      {/if}
      {#if ui.settingsOpen}<SettingsPanel />{/if}
      {#if ui.aboutOpen}<AboutPanel />{/if}
    </div>
  </div>
</div>

<style>
  .layout {
    position: relative;
    height: 100%;
    overflow: hidden;
  }
  /* Clicks fall through to the views, but for the panels on it. */
  .interface {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    width: calc(100% / var(--ui-scale));
    height: calc(100% / var(--ui-scale));
    transform: scale(var(--ui-scale));
    transform-origin: top left;
    pointer-events: none;
  }
  .interface :global(.panel) {
    pointer-events: auto;
  }
  .top {
    position: relative;
    z-index: 2;
  }
  .below {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .selected {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    flex-direction: column;
    width: min(440px, calc(100% - 12px));
    max-height: calc(100% - 12px);
  }
  .selected > :global(*) {
    min-height: 0;
  }
</style>
