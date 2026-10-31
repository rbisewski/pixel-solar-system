/** A redraw that can wait for a later frame; the higher its urgency, the sooner it runs. */
export interface Redraw {
  urgency: number;
  run: () => void;
}

/** Runs the most urgent redraws until the time budget is spent, always at least one; returns how many ran. */
export function runRedraws(redraws: Redraw[], budgetMs: number, now: () => number = () => performance.now()): number {
  redraws.sort((a, b) => b.urgency - a.urgency);
  const start = now();
  let ran = 0;
  for (const redraw of redraws) {
    if (ran > 0 && now() - start >= budgetMs) break;
    redraw.run();
    ran++;
  }
  return ran;
}
