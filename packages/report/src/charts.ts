// Server-side SVG chart renderers, ported from the approved mock's client-side
// donut() / lineChart() / hbar(). Same coordinate math; output is a static string
// (no JavaScript) so the report renders anywhere and is byte-stable.

import { el, esc, fmt, fmtK } from "./svg";

/** Round to 2dp for clean, deterministic path/coordinate output. */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

function text(
  x: number,
  y: number,
  s: string,
  extra: Record<string, string | number> = {},
): string {
  const base: Record<string, string | number> = {
    x: r(x),
    y: r(y),
    fill: "#676e79",
    "font-size": 11,
    "font-family": "ui-monospace,Menlo,monospace",
  };
  return el("text", { ...base, ...extra }, esc(s));
}

export interface DonutItem {
  value: number;
  color: string;
}

/** Donut for the traffic split. */
export function donutSvg(
  items: DonutItem[],
  opts: { centerTop: string; centerBottom: string; aria: string },
): string {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const r1 = 86;
  const r2 = 55;
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  let a0 = -Math.PI / 2;
  const paths: string[] = [];
  for (const it of items) {
    if (it.value <= 0) continue;
    const a1 = a0 + 2 * Math.PI * (it.value / total);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const d =
      `M ${r(cx + r1 * Math.cos(a0))} ${r(cy + r1 * Math.sin(a0))} ` +
      `A ${r1} ${r1} 0 ${big} 1 ${r(cx + r1 * Math.cos(a1))} ${r(cy + r1 * Math.sin(a1))} ` +
      `L ${r(cx + r2 * Math.cos(a1))} ${r(cy + r2 * Math.sin(a1))} ` +
      `A ${r2} ${r2} 0 ${big} 0 ${r(cx + r2 * Math.cos(a0))} ${r(cy + r2 * Math.sin(a0))} Z`;
    paths.push(el("path", { d, fill: it.color, stroke: "#fff", "stroke-width": 1.5 }));
    a0 = a1;
  }
  const center =
    text(cx, cy - 4, opts.centerTop, {
      "text-anchor": "middle",
      "font-size": 22,
      "font-weight": 700,
      fill: "#16181d",
      "font-family": "inherit",
    }) + text(cx, cy + 15, opts.centerBottom, { "text-anchor": "middle", "font-size": 10.5 });
  return el(
    "svg",
    {
      viewBox: `0 0 ${size} ${size}`,
      style: "width:190px;min-width:190px",
      role: "img",
      "aria-label": opts.aria,
    },
    paths.join("") + center,
  );
}

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
  dash?: string;
  endLabel?: boolean;
}

export interface LineChartCfg {
  labels: string[];
  yMax: number;
  yTicks: number;
  tickEvery: number;
  bands?: number[];
  xLab: string;
  yLab: string;
  series: LineSeries[];
  aria: string;
}

/** Multi-series daily line chart. */
export function lineChartSvg(cfg: LineChartCfg): string {
  const W = 760;
  const H = 300;
  const L = 56;
  const R = 30;
  const T = 14;
  const B = 46;
  const pw = W - L - R;
  const ph = H - T - B;
  const n = cfg.labels.length;
  const x = (i: number) => L + pw * (n === 1 ? 0.5 : i / (n - 1));
  const y = (v: number) => T + ph * (1 - v / (cfg.yMax || 1));
  const parts: string[] = [];

  for (const i of cfg.bands ?? []) {
    const x0 = Math.max(L, x(i - 0.5));
    const x1 = Math.min(L + pw, x(i + 0.5));
    parts.push(el("rect", { x: r(x0), y: T, width: r(x1 - x0), height: ph, fill: "#eef0ea" }));
  }

  const step = cfg.yMax / cfg.yTicks;
  for (let t = 0; t <= cfg.yTicks; t++) {
    const v = step * t;
    const yy = y(v);
    parts.push(
      el("line", { x1: L, y1: r(yy), x2: L + pw, y2: r(yy), stroke: "#e7e8e2", "stroke-width": 1 }),
    );
    parts.push(text(L - 8, yy + 4, fmtK(v), { "text-anchor": "end" }));
  }

  cfg.labels.forEach((lab, i) => {
    const isLast = i === n - 1;
    if (!isLast && (i % cfg.tickEvery !== 0 || n - 1 - i < cfg.tickEvery)) return;
    parts.push(text(x(i), T + ph + 16, lab, { "text-anchor": "middle" }));
  });

  parts.push(
    text(L + pw / 2, H - 6, cfg.xLab, {
      "text-anchor": "middle",
      "font-size": 11.5,
      fill: "#4c5560",
      "font-family": "inherit",
    }),
  );
  const yMid = T + ph / 2;
  parts.push(
    text(14, yMid, cfg.yLab, {
      "text-anchor": "middle",
      "font-size": 11.5,
      fill: "#4c5560",
      "font-family": "inherit",
      transform: `rotate(-90 14 ${r(yMid)})`,
    }),
  );

  for (const s of cfg.series) {
    const pts = s.values.map((v, i) => `${r(x(i))},${r(y(v))}`).join(" ");
    parts.push(
      el("polyline", {
        points: pts,
        fill: "none",
        stroke: s.color,
        "stroke-width": 2.4,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "stroke-dasharray": s.dash ?? "none",
      }),
    );
    if (n <= 16) {
      s.values.forEach((v, i) => {
        parts.push(el("circle", { cx: r(x(i)), cy: r(y(v)), r: 2.6, fill: s.color }));
      });
    }
    const last = s.values[n - 1] ?? 0;
    parts.push(el("circle", { cx: r(x(n - 1)), cy: r(y(last)), r: 3.6, fill: s.color }));
    if (s.endLabel) {
      parts.push(
        text(x(n - 1) - 4, y(last) - 9, fmt(last), {
          "text-anchor": "end",
          fill: s.color,
          "font-weight": 700,
        }),
      );
    }
  }

  return el(
    "svg",
    { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": cfg.aria },
    parts.join(""),
  );
}

export interface HbarItem {
  label: string;
  value: number;
  color: string;
  note?: string;
}

export interface HbarCfg {
  items: HbarItem[];
  xMax: number;
  xTicks: number;
  xLab: string;
  aria: string;
  W?: number;
  labW?: number;
  valW?: number;
}

/** Horizontal bar chart (agent families, 404 paths). */
export function hbarSvg(cfg: HbarCfg): string {
  const W = cfg.W ?? 760;
  const rowH = 34;
  const labW = cfg.labW ?? 210;
  const valW = cfg.valW ?? 76;
  const T = 6;
  const B = 42;
  const n = cfg.items.length;
  const H = T + n * rowH + B;
  const pw = W - labW - valW - 16;
  const max = cfg.xMax || 1;
  const xv = (v: number) => labW + pw * (v / max);
  const parts: string[] = [];

  for (let t = 0; t <= cfg.xTicks; t++) {
    const v = (max / cfg.xTicks) * t;
    const xx = xv(v);
    parts.push(el("line", { x1: r(xx), y1: T, x2: r(xx), y2: T + n * rowH, stroke: "#e7e8e2" }));
    parts.push(text(xx, T + n * rowH + 16, fmtK(v), { "text-anchor": "middle" }));
  }
  parts.push(
    text(labW + pw / 2, H - 6, cfg.xLab, {
      "text-anchor": "middle",
      "font-size": 11.5,
      fill: "#4c5560",
      "font-family": "inherit",
    }),
  );

  cfg.items.forEach((it, i) => {
    const yy = T + i * rowH + rowH / 2;
    parts.push(
      text(labW - 10, yy + 4, it.label, { "text-anchor": "end", "font-size": 12, fill: "#16181d" }),
    );
    parts.push(
      el("rect", {
        x: labW,
        y: r(yy - 9),
        width: r(Math.max(2, pw * (it.value / max))),
        height: 18,
        rx: 3,
        fill: it.color,
      }),
    );
    parts.push(
      text(xv(it.value) + 7, yy + 4, fmt(it.value) + (it.note ? ` ${it.note}` : ""), {
        "font-size": 11.5,
        fill: "#3d434c",
      }),
    );
  });

  const svgAttrs: Record<string, string | number> = {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": cfg.aria,
  };
  if (cfg.W && cfg.W < 640) svgAttrs.style = `min-width:${cfg.W}px`;
  return el("svg", svgAttrs, parts.join(""));
}
