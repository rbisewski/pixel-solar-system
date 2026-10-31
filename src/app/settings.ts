// The user's settings, kept per browser.

export interface Settings {
  /** Hide everything but the stars behind a body zoomed into in the 3D view while the clock runs fast: bodies racing past can make people queasy. */
  hideObjectsWhenUnpaused: boolean;
  /** Let the stars trail streaks as the sky turns with the clock on the globe, rather than staying points. */
  blurStars: boolean;
  /** The size of the panels and controls, as a fraction of their normal size. */
  uiScale: number;
}

const KEY = "pixel-solar-system-settings";
export const UI_SCALES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const DEFAULTS: Settings = { hideObjectsWhenUnpaused: true, blurStars: true, uiScale: 1 };

type Store = Pick<Storage, "getItem" | "setItem">;

/** Whether the browser asks for less motion: star streaking then starts off. */
const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The saved settings, with the defaults for any missing or unreadable. */
export function loadSettings(store: Store = localStorage, reducedMotion = prefersReducedMotion()): Settings {
  const defaults = { ...DEFAULTS, blurStars: !reducedMotion };
  try {
    const saved = JSON.parse(store.getItem(KEY) ?? "{}") as Partial<Settings>;
    return {
      hideObjectsWhenUnpaused: typeof saved.hideObjectsWhenUnpaused === "boolean" ? saved.hideObjectsWhenUnpaused : defaults.hideObjectsWhenUnpaused,
      blurStars: typeof saved.blurStars === "boolean" ? saved.blurStars : defaults.blurStars,
      uiScale: UI_SCALES.includes(saved.uiScale as number) ? (saved.uiScale as number) : defaults.uiScale,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings, store: Store = localStorage): void {
  try {
    store.setItem(KEY, JSON.stringify(settings));
  } catch {
    // The setting still holds for this session.
  }
}
