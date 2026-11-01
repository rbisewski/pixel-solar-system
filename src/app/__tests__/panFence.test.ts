import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { fencePan, PAN_FENCE_AU } from "../solar/panFence";

const at = (x: number, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sun = at(0);

describe("the pan fence", () => {
  it("leaves a point inside the fence where it is", () => {
    expect(fencePan(at(100, 50), sun, at(1)).toArray()).toEqual([100, 50, 0]);
  });

  it("brings a point beyond the fence back along its line from the Sun", () => {
    const fenced = fencePan(at(300, 400), sun, at(1));
    expect(fenced.length()).toBeCloseTo(PAN_FENCE_AU);
    expect(fenced.x / fenced.y).toBeCloseTo(300 / 400);
  });

  it("is measured from the Sun, wherever the Sun is", () => {
    const off = at(10);
    expect(fencePan(at(500), off, at(11)).x).toBeCloseTo(10 + PAN_FENCE_AU);
  });

  it("doesn't pull the view off a body beyond the fence, nor let it pan further out", () => {
    const far = at(900);
    expect(fencePan(far, sun, far).x).toBe(900);
    expect(fencePan(at(1000), sun, far).x).toBeCloseTo(900);
    expect(fencePan(at(500), sun, far).x).toBe(500);
  });

  it("doesn't change the point it is given", () => {
    const point = at(500);
    fencePan(point, sun, at(1));
    expect(point.x).toBe(500);
  });
});
