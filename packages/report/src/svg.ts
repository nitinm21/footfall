// Minimal string-building helpers for server-rendered, self-contained HTML/SVG.

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML/attribute-escape a string. */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/** Deterministic thousands separators (locale-independent, unlike toLocaleString). */
export function fmt(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Compact number for axis ticks: 1000 → "1k". */
export function fmtK(n: number): string {
  return n >= 1000 ? `${n / 1000}k` : `${n}`;
}

type AttrValue = string | number | undefined | false;

/** Render an attribute map, skipping undefined/false/empty values. */
export function attrs(map: Record<string, AttrValue>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === false || v === "") continue;
    parts.push(`${k}="${esc(String(v))}"`);
  }
  return parts.join(" ");
}

/** Build an element with attributes and pre-built inner markup. */
export function el(name: string, map: Record<string, AttrValue>, inner = ""): string {
  const a = attrs(map);
  return `<${name}${a ? ` ${a}` : ""}>${inner}</${name}>`;
}
