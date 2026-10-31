// What the user has open: the view, the selection and the settings.

import { loadSettings, saveSettings, type Settings } from "./settings";

class Ui {
  /** Which view has the camera: the Solar System, or the Earth's globe (zoom in on the Earth to reach it). */
  view = $state<"earth" | "solar">("solar");
  /** The body whose panel is open in the Solar System view, if any. */
  selectedBodyId = $state<string | null>(null);
  /** The country whose panel is open on the globe, if any. */
  selectedCountryId = $state<string | null>(null);
  settings = $state.raw<Settings>(loadSettings());
  settingsOpen = $state(false);
  aboutOpen = $state(false);
  /** A country the globe should turn to once it has the camera, from a search. */
  countryToFace = $state<string | null>(null);

  updateSettings(changes: Partial<Settings>): void {
    this.settings = { ...this.settings, ...changes };
    saveSettings(this.settings);
  }
}

export const ui = new Ui();
