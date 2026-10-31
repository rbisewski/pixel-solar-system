<script lang="ts">
  // A country's panel, opened by clicking it on the globe.
  import { content } from "../../content/index";
  import { ui } from "../ui.svelte";
  import Flag from "../ui/Flag.svelte";
  import { compact, figureYear, grouped } from "../ui/format";
  import Icon from "../ui/Icon.svelte";

  const country = $derived(content.countries.find((c) => c.id === ui.selectedCountryId) ?? null);

  /** Every figure not from the World Bank, with where it came from. */
  const cited = $derived(
    country
      ? ([["Population", country.population], ["GDP", country.gdp], ["Area", country.area]] as const).flatMap(([label, f]) => (f?.source ? [`${label}: ${f.source}`] : []))
      : [],
  );

  const close = () => (ui.selectedCountryId = null);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

{#if country}
  <section class="panel country">
    <header class="title">
      <Flag countryId={country.id} height={18} />
      <h2>{country.name}</h2>
      <button class="icon-button" title="Close (Esc)" onclick={close}><Icon name="close" size={16} /></button>
    </header>
    <dl>
      <dt>Capital</dt><dd>{country.capital.name}</dd>
      <dt>Population</dt><dd>{compact(country.population.value)}{figureYear(country.population)}</dd>
      <dt>GDP</dt><dd>{country.gdp ? `$${compact(country.gdp.value)}${figureYear(country.gdp)}` : "Unknown"}</dd>
      <dt>GDP per capita</dt><dd>{country.gdpPerCapita ? `$${grouped(country.gdpPerCapita.value)}${figureYear(country.gdpPerCapita)}` : "Unknown"}</dd>
      <dt>Area</dt><dd>{country.area.value < 10 ? country.area.value : grouped(country.area.value)} km²{figureYear(country.area)}</dd>
    </dl>
    <p class="note muted">
      {[...cited.map((c) => `${c}.`), ...(cited.length < 3 ? [cited.length > 0 ? "Otherwise World Bank." : "Source: World Bank."] : [])].join(" ")}
    </p>
  </section>
{/if}

<style>
  .country {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--header);
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 0.95em;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--header-text);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
    padding: 8px 10px 4px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .note {
    margin: 0;
    padding: 0 10px 8px;
    font-size: 0.8em;
  }
</style>
