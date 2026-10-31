// How many device pixels the views draw per CSS pixel. The art is chunky pixels either way, so
// on a touch screen, whose GPU has the most to lose, fewer are hard to see but much faster.

const MOST = 2;
const MOST_ON_TOUCH = 1.25;

export function renderScale(): number {
  return Math.min(window.devicePixelRatio, matchMedia("(pointer: coarse)").matches ? MOST_ON_TOUCH : MOST);
}
