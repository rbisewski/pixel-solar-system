import { describe, expect, it } from "vitest";
import { Pinch } from "../pinch";

const touch = (pointerId: number, clientX: number, clientY = 0) => ({ pointerType: "touch", pointerId, clientX, clientY });

describe("a pinch", () => {
  it("measures the fingers' spread from where it began", () => {
    const pinch = new Pinch();
    pinch.down(touch(1, 0));
    expect(pinch.active).toBe(false);
    expect(pinch.move(touch(1, 10))).toBeNull();
    pinch.down(touch(2, 110));
    expect(pinch.active).toBe(true);
    expect(pinch.move(touch(2, 210))).toBe(2);
    expect(pinch.move(touch(1, 160))).toBe(0.5);
  });

  it("ends when a finger lifts", () => {
    const pinch = new Pinch();
    pinch.down(touch(1, 0));
    pinch.down(touch(2, 100));
    pinch.up({ pointerId: 2 });
    expect(pinch.active).toBe(false);
    expect(pinch.move(touch(1, 50))).toBeNull();
  });

  it("doesn't zoom while two fingers drag together, however unevenly", () => {
    const pinch = new Pinch();
    pinch.down(touch(1, 0));
    pinch.down(touch(2, 200));
    pinch.move(touch(1, 53));
    pinch.move(touch(2, 247));
    expect(pinch.takeZoom()).toBe(1);
  });

  it("zooms from where the fingers had spread to, with no jump, and by each change after", () => {
    const pinch = new Pinch();
    pinch.down(touch(1, 0));
    pinch.down(touch(2, 100));
    pinch.move(touch(2, 120));
    expect(pinch.takeZoom()).toBe(1);
    pinch.move(touch(2, 180));
    expect(pinch.takeZoom()).toBeCloseTo(1.5);
    expect(pinch.takeZoom()).toBe(1);
    pinch.move(touch(2, 90));
    expect(pinch.takeZoom()).toBeCloseTo(0.5);
  });

  it("starts over for the next pinch", () => {
    const pinch = new Pinch();
    pinch.down(touch(1, 0));
    pinch.down(touch(2, 100));
    pinch.move(touch(2, 200));
    pinch.takeZoom();
    pinch.up({ pointerId: 2 });
    expect(pinch.takeZoom()).toBe(1);
    pinch.down(touch(2, 200));
    pinch.move(touch(2, 201));
    expect(pinch.takeZoom()).toBe(1);
  });

  it("ignores the mouse", () => {
    const pinch = new Pinch();
    pinch.down({ ...touch(1, 0), pointerType: "mouse" });
    expect(pinch.move(touch(1, 50))).toBeNull();
  });
});
