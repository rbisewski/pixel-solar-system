<script lang="ts">
  // The search box in the clock bar: finds bodies and countries, and flies to the one chosen.
  import { content } from "../../content/index";
  import { goToBody, goToCountry } from "../navigate";
  import { search, type SearchResult } from "../search";
  import Icon from "../ui/Icon.svelte";

  let query = $state("");
  let open = $state(false);
  let active = $state(0);
  let input: HTMLInputElement;

  const results = $derived(search(content, query));

  function choose(result: SearchResult) {
    if (result.kind === "body") goToBody(result.id);
    else goToCountry(result.id);
    query = "";
    open = false;
    // Space and the like go back to the clock.
    input.blur();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) active = (active + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length;
    } else if (event.key === "Enter") {
      const result = results[active];
      if (result) choose(result);
    } else if (event.key === "Escape") {
      // It closes this, not the panel behind it as well.
      event.stopPropagation();
      query = "";
      open = false;
      input.blur();
    }
  }
</script>

<div class="search">
  <Icon name="search" size={14} color="var(--muted)" />
  <input
    bind:this={input}
    bind:value={query}
    type="search"
    placeholder="Search bodies and countries"
    aria-label="Search bodies and countries"
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    oninput={() => { open = true; active = 0; }}
    onkeydown={onKey}
  />
  {#if open && query.trim()}
    <ul class="results panel">
      {#each results as result, i (`${result.kind}:${result.id}`)}
        <!-- Pressed, not clicked: a click would come after the input's blur has closed the list. -->
        <li>
          <button class:active={i === active} onpointerdown={(e) => { e.preventDefault(); choose(result); }}>
            <span class="name">{result.name}</span><span class="muted">{result.detail}</span>
          </button>
        </li>
      {:else}
        <li class="none muted">Nothing found</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 0 1 260px;
    min-width: 150px;
  }
  input {
    flex: 1;
    min-width: 0;
    background: var(--cell);
    cursor: text;
  }
  .results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: max(100%, 300px);
    max-width: calc(100vw - 16px);
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--panel-solid);
  }
  .results button {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    border: 0;
    background: none;
    text-align: left;
  }
  .results button.active,
  .results button:hover:not(:disabled) {
    background: var(--button-hover);
  }
  .name {
    overflow-wrap: anywhere;
  }
  .none {
    padding: 3px 8px;
  }
</style>
