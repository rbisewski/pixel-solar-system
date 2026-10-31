// Number formatting: 31.2K, 1.4M, 29,991.

export function compact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(digits)}K`;
  return n.toFixed(abs >= 100 || Number.isInteger(n) ? 0 : digits);
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Scientific notation with a superscript exponent: 3.37 × 10¹⁸. */
export function scientific(n: number, digits = 3): string {
  if (n === 0) return "0";
  const [mantissa, exponent] = n.toExponential(digits - 1).split("e") as [string, string];
  const power = [...String(Number(exponent))].map((c) => (c === "-" ? "⁻" : SUPERSCRIPT[Number(c)])).join("");
  return `${mantissa} × 10${power}`;
}

export function grouped(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}


/** A figure's year, as a suffix to its value. */
export function figureYear(figure: { year: number | null }): string {
  return figure.year === null ? "" : ` (${figure.year})`;
}
