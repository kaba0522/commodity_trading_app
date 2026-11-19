/**
 * Central money/weight formatters (prototypes show price-per-unit labels
 * everywhere — keep them consistent via these helpers, no ad-hoc strings).
 */

/** 4850 -> "₹4,850", 12600 -> "₹12,600" (manual Indian grouping, no Intl dependency). */
export function priceLabel(price: number): string {
  const rounded = Math.round(price);
  const s = String(Math.abs(rounded));
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/(\d)(?=(\d{2})+$)/g, "$1,");
  const out = (rest ? `${grouped},${last3}` : last3) || "0";
  return `₹${rounded < 0 ? "-" : ""}${out}`;
}

/** 40 -> "40 bags", 1 -> "1 bag". */
export function bagsLabel(bags: number): string {
  return `${bags} bag${bags === 1 ? "" : "s"}`;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Backend dates arrive as ISO strings ("2026-10-01T00:00:00.000Z") — render a
 * short readable date ("1 Oct 2026") instead of the raw timestamp. Manual month
 * names, no Intl dependency (unreliable on some Android builds). Returns the
 * input unchanged when it is not a valid date.
 */
export function formatDateLabel(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
