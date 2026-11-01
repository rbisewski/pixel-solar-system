import * as THREE from "three";

/** How far from the Sun (AU) panning can take the point the camera looks at. */
export const PAN_FENCE_AU = 150;

/**
 * Where a panned look-at point ends up: inside the fence around the Sun, or for a body out beyond
 * the fence (some reach thousands of AU), no further from the Sun than that body.
 */
export function fencePan(point: THREE.Vector3, sun: THREE.Vector3, body: THREE.Vector3): THREE.Vector3 {
  const limit = Math.max(PAN_FENCE_AU, body.distanceTo(sun));
  const fromSun = point.clone().sub(sun);
  return fromSun.length() > limit ? fromSun.setLength(limit).add(sun) : point.clone();
}
