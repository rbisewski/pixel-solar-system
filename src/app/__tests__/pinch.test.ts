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

  it("ignores the mouse", () => {
    const pinch = new Pinch();
    pinch.down({ ...touch(1, 0), pointerType: "mouse" });
    expect(pinch.move(touch(1, 50))).toBeNull();
  });
});
