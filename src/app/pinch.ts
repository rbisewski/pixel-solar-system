// Follows two fingers on a view, so a pinch can carry on from one view into the other as the
// wheel does. OrbitControls does the zooming itself, and doesn't say when it has reached its limit.

export class Pinch {
  private readonly touches = new Map<number, { x: number; y: number }>();
  /** How far apart the fingers were when the pinch began. */
  private startSpread = 0;
  /** The spread last taken as zoom (takeZoom), or 0 until the fingers have spread enough to be zooming. */
  private takenSpread = 0;

  /** Whether two or more fingers are down. */
  get active(): boolean {
    return this.touches.size >= 2;
  }

  private spread(): number {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  down(event: Pick<PointerEvent, "pointerType" | "pointerId" | "clientX" | "clientY">): void {
    if (event.pointerType !== "touch") return;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.startSpread = this.spread();
    this.takenSpread = 0;
  }

  up(event: Pick<PointerEvent, "pointerId">): void {
    this.touches.delete(event.pointerId);
  }

  /** Follows a finger, and returns how far the fingers have spread since the pinch began (2 is twice as far apart), or null if this isn't a pinch. */
  move(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">): number | null {
    if (!this.touches.has(event.pointerId)) return null;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    return this.active && this.startSpread > 0 ? this.spread() / this.startSpread : null;
  }

  /**
   * The change in the fingers' spread since this was last asked (2 is twice as far apart), as a
   * zoom: 1 until they have spread or closed by ZOOM_FROM, so that two fingers dragging together,
   * never quite the same distance apart, don't zoom.
   */
  takeZoom(): number {
    if (!this.active || this.startSpread <= 0) return 1;
    const spread = this.spread();
    if (spread <= 0) return 1;
    if (this.takenSpread === 0) {
      if (Math.abs(Math.log(spread / this.startSpread)) < Math.log(ZOOM_FROM)) return 1;
      this.takenSpread = spread;
      return 1;
    }
    const zoom = spread / this.takenSpread;
    this.takenSpread = spread;
    return zoom;
  }

  clear(): void {
    this.touches.clear();
  }
}

/** How far two fingers must spread or close before they are zooming rather than dragging together. */
const ZOOM_FROM = 1.06;

/** How far a pinch must go at the end of a view's zoom to carry on into the other, so a slip of the fingers doesn't. */
export const PINCH_IN = 1.15;
export const PINCH_OUT = 1 / PINCH_IN;
