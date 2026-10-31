<script lang="ts">
  // A country's current flag, or its code if it has none.
  import { content } from "../../content/index";
  import { flagUrl } from "./flags";

  let { countryId, height = 14 }: { countryId: string; height?: number } = $props();

  const url = $derived(flagUrl(countryId));
  const name = $derived(content.countries.find((n) => n.id === countryId)?.name ?? countryId.toUpperCase());
</script>

{#if url}
  <img class="flag" src={url} alt={name} title={name} width={Math.round((height * 4) / 3)} {height} />
{:else}
  <span class="flag code" title={name} style:height="{height}px" style:font-size="{Math.round(height * 0.7)}px">{countryId.toUpperCase()}</span>
{/if}

<style>
  .flag {
    display: inline-block;
    flex: none;
    vertical-align: middle;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--border);
  }
  .code {
    display: inline-flex;
    align-items: center;
    padding: 0 3px;
    color: var(--accent);
    background: var(--cell);
  }
</style>
