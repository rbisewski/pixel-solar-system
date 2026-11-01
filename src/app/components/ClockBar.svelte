<script lang="ts">
  // The bar along the top: search, the date and time in UTC, and the clock's controls.
  import { fromDateInput, MAX_MS, MIN_MS, RATES, toDateInput } from "../../astro/time";
  import { clock } from "../clock.svelte";
  import { ui } from "../ui.svelte";
  import Icon from "../ui/Icon.svelte";
  import Search from "./Search.svelte";

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const pad = (n: number) => String(n).padStart(2, "0");

  const at = $derived(new Date(clock.ms));
  const date = $derived(`${pad(at.getUTCDate())} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`);
  const time = $derived(`${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`);

  /** The date picker, open while choosing a date to jump to. */
  let picker = $state<HTMLInputElement>();
  let picking = $state(false);
  /** What the picker starts on: the clock runs on underneath, and mustn't change it mid-choice. */
  let pickFrom = $state("");

  function openPicker() {
    pickFrom = toDateInput(clock.ms);
    picking = true;
  }

  $effect(() => {
    picker?.focus();
  });

  // A half-typed year passes through dates out of range, which are ignored until it is whole.
  function pick(event: Event) {
    const ms = fromDateInput((event.currentTarget as HTMLInputElement).value, clock.ms);
    if (ms !== null) clock.jumpTo(ms);
  }

  function onPickerKey(event: KeyboardEvent) {
    if (event.key !== "Escape" && event.key !== "Enter") return;
    event.stopPropagation();
    picking = false;
  }

  function onKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === " ") {
      event.preventDefault();
      clock.togglePause();
    } else if (event.key === "+" || event.key === "=") clock.faster();
    else if (event.key === "-") clock.slower();
  }
</script>

<!-- Space is the clock's, so it mustn't also press a focused button, which happens on its release. -->
<svelte:window onkeydown={onKey} onkeyup={(e) => e.key === " " && !(e.target instanceof HTMLInputElement) && e.preventDefault()} />

<header class="bar panel">
  <span class="title">Pixel Solar System</span>
  <Search />
  <span class="spacer"></span>
  <button class="icon-button" title="Settings" onclick={() => { ui.settingsOpen = !ui.settingsOpen; ui.aboutOpen = false; }}><Icon name="settings" /></button>
  <button class="icon-button" title="About and sources" onclick={() => { ui.aboutOpen = !ui.aboutOpen; ui.settingsOpen = false; }}><Icon name="info" /></button>
  {#if picking}
    <input bind:this={picker} class="picker" type="date" aria-label="Jump to a date" min={toDateInput(MIN_MS)} max={toDateInput(MAX_MS)} value={pickFrom} onchange={pick} onblur={() => (picking = false)} onkeydown={onPickerKey} />
  {:else}
    <button class="when" title="Jump to a date, 1900 to 2100" onclick={openPicker}><Icon name="calendar" size={14} /> {date} <span class="muted">{time} UTC</span></button>
  {/if}
  <button class="icon-button" title={clock.rate > 0 ? "Pause (Space)" : "Resume (Space)"} onclick={() => clock.togglePause()}>
    <Icon name={clock.rate > 0 ? "pause" : "play"} />
  </button>
  <div class="rates" role="group" aria-label="Clock rate">
    {#each RATES as r (r.rate)}
      <button class:active={clock.rate === r.rate} onclick={() => clock.setRate(r.rate)}>{r.label}</button>
    {/each}
  </div>
  <button onclick={() => clock.now()}>Now</button>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 36px;
    padding: 3px 8px;
  }
  .title {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--header-text);
  }
  .spacer {
    flex: 1;
  }
  .when {
    white-space: nowrap;
  }
  .picker {
    cursor: text;
  }
  /* On a phone the bar already takes up a good part of the screen. */
  @media (max-width: 600px) {
    .title,
    .spacer {
      display: none;
    }
  }
  .rates {
    display: flex;
    gap: 2px;
  }
  .rates .active {
    background: var(--button-hover);
    color: var(--accent);
  }
</style>
