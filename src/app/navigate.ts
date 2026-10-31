// Flying to something found by search, from whichever view has the camera.

import { handoff } from "./solar/handoff";
import { ui } from "./ui.svelte";

/** Opens a body's panel and flies to it, taking the camera from the globe if that has it. */
export function goToBody(id: string): void {
  if (ui.view === "earth" && handoff.globe) {
    const { direction, distance } = handoff.globe.cameraPlace();
    handoff.direction.copy(direction);
    handoff.distance = distance;
    ui.view = "solar";
  } else {
    handoff.solar?.focus(id);
  }
  ui.selectedBodyId = id;
}

/** Opens a country's panel and turns the globe to its capital, flying home first if need be. */
export function goToCountry(id: string): void {
  ui.selectedCountryId = id;
  ui.countryToFace = id;
  if (ui.view === "solar") {
    if (handoff.solar) handoff.solar.returnToEarth();
    else ui.view = "earth";
  }
}
