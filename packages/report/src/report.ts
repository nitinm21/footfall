import type { AnalysisResult, FailureFinding, VisitorClass } from "@footfall/core";
import { donutSvg, type HbarItem, hbarSvg, lineChartSvg } from "./charts";
import { STYLES } from "./styles";
import { el, esc, fmt } from "./svg";

/** Accuracy figures printed in the footer (from the checked-in baseline). */
export interface AccuracySummary {
  overallAccuracy: number;
  unclassifiedRate: number;
  tier1Precision: number;
}

export interface ReportOptions {
  siteName?: string;
  accuracy?: AccuracySummary;
  /** ISO timestamp for the footer; omitted → not shown (keeps goldens stable). */
  generatedAt?: string;
  /** Build hash for the footer; the golden test normalizes this. */
  buildHash?: string;
}

const CLASS_COLOR: Record<VisitorClass, string> = {
  human: "#9aa1ab",
  agent: "#2743d6",
  crawler: "#d99a2b",
  unclassified: "#c9cdd4",
};

const CLASS_LABEL: Record<VisitorClass, string> = {
  human: "Humans",
  agent: "AI agents",
  crawler: "Crawlers / bots",
  unclassified: "Unclassified",
};

const FAMILY_COLOR: Record<string, string> = {
  "claude-code": "#d97757",
  cursor: "#16181d",
  codex: "#10a37f",
  "codex-suspect": "#10a37f",
  perplexitybot: "#20808d",
  "perplexity-user": "#20808d",
  unidentified: "#b9bec6",
  "generic-bot": "#d99a2b",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function familyLabel(family: string, heuristic: boolean): string {
  const named: Record<string, string> = {
    "claude-code": "Claude Code",
    cursor: "Cursor",
    codex: "Codex",
    "codex-suspect": "Codex-suspect",
    unidentified: "Unidentified agent",
    "generic-bot": "Bot",
    perplexitybot: "Perplexity",
    "perplexity-user": "Perplexity",
  };
  const base =
    named[family] ?? family.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return heuristic ? `${base} ⚠ behavioral` : base;
}

function niceCeil(v: number): number {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (p * m >= v) return p * m;
  }
  return p * 10;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function dateRange(from: number | null, to: number | null): string {
  if (from === null || to === null) return "unknown range";
  const a = fmtDate(from);
  const b = fmtDate(to);
  return a === b ? a : `${a} – ${b}`;
}

function coveragePresent(result: AnalysisResult, field: string): boolean {
  return result.coverage.find((r) => r.field === field)?.present ?? false;
}

function mod(title: string, inner: string, chips = ""): string {
  return el(
    "section",
    { class: "mod" },
    `<div class="modhead"><h2>${esc(title)}</h2>${chips}</div>${inner}`,
  );
}

function heurChip(): string {
  return `<span class="chip heur">HEURISTIC</span>`;
}

// ── modules ──────────────────────────────────────────────────────────────────

function reportHead(result: AnalysisResult, siteName: string): string {
  const deadEnds = result.failureTotals.dead_end;
  const headline = `${result.agentSharePct}% of ${esc(siteName)}'s traffic is AI agents — and <em>${fmt(deadEnds)} of their requests dead-ended.</em>`;
  const meta = [
    `<span><b>${fmt(result.meta.totalRequests)}</b> requests</span>`,
    `<span><b>${esc(dateRange(result.meta.from, result.meta.to))}</b></span>`,
    `<span><b>${esc(result.meta.source)}</b> export</span>`,
    `<span><b>${result.meta.classifiedPct}%</b> classified</span>`,
  ].join("");
  return `<div class="report-head"><div class="eyebrow">Agent traffic report</div><h2>${headline}</h2><div class="meta">${meta}</div></div>`;
}

function whoIsVisiting(result: AnalysisResult): string {
  const items = result.trafficSplit
    .filter((r) => r.requests > 0)
    .map((r) => ({ value: r.requests, color: CLASS_COLOR[r.class], name: CLASS_LABEL[r.class] }));
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const donut = donutSvg(items, {
    centerTop: `${result.agentSharePct}%`,
    centerBottom: "AI agents",
    aria: "Traffic split by visitor class",
  });
  const legend = items
    .map(
      (it) =>
        `<div><span class="sw" style="background:${it.color}"></span><span class="l">${esc(it.name)}</span><span class="v num">${fmt(it.value)} · ${((100 * it.value) / total).toFixed(1)}%</span></div>`,
    )
    .join("");

  const days = result.daily;
  const maxVal = Math.max(1, ...days.flatMap((d) => [d.human, d.agent, d.crawler]));
  const line = lineChartSvg({
    aria: "Requests per day by visitor class",
    labels: days.map(
      (d) => `${MONTHS[Number(d.date.slice(5, 7)) - 1]} ${Number(d.date.slice(8, 10))}`,
    ),
    yMax: niceCeil(maxVal),
    yTicks: 4,
    tickEvery: days.length <= 8 ? 1 : Math.ceil(days.length / 7),
    xLab: "Date",
    yLab: "Requests per day",
    series: [
      { name: "Humans", color: CLASS_COLOR.human, values: days.map((d) => d.human) },
      {
        name: "AI agents",
        color: CLASS_COLOR.agent,
        endLabel: true,
        values: days.map((d) => d.agent),
      },
      {
        name: "Crawlers",
        color: CLASS_COLOR.crawler,
        dash: "4 4",
        values: days.map((d) => d.crawler),
      },
    ],
  });
  const legendLine = ["Humans", "AI agents", "Crawlers"]
    .map(
      (n, i) =>
        `<span><span class="sw" style="background:${[CLASS_COLOR.human, CLASS_COLOR.agent, CLASS_COLOR.crawler][i]}"></span>${n}</span>`,
    )
    .join("");

  const inner = `<div class="donut-row" style="margin:4px 0 22px"><div>${donut}</div><div class="donut-legend">${legend}</div></div><div class="chart">${line}</div><div class="legend">${legendLine}</div>`;
  return mod("Who is visiting", inner);
}

function agentFamilies(result: AnalysisResult): string {
  if (result.families.length === 0) {
    return mod(
      "Agent families",
      `<div class="footnote">No agent traffic classified in this window.</div>`,
    );
  }
  const items: HbarItem[] = result.families.map((f) => ({
    label: familyLabel(f.family, f.heuristic),
    value: f.requests,
    color: FAMILY_COLOR[f.family] ?? "#7c6fd0",
    ...(f.heuristic ? { note: "⚠" } : {}),
  }));
  const chart = hbarSvg({
    items,
    xMax: niceCeil(Math.max(1, ...items.map((i) => i.value))),
    xTicks: 4,
    xLab: "Agent requests",
    aria: "Agent requests by family",
  });
  const anyHeur = result.families.some((f) => f.heuristic);
  const footnote = anyHeur
    ? `<div class="footnote">⚠ Behavioral estimate — no distinguishing user-agent; family inferred from behavior.</div>`
    : "";
  return mod("Agent families", `<div class="chart">${chart}</div>${footnote}`);
}

function topPages(result: AnalysisResult): string {
  const rows = result.topPages
    .slice(0, 10)
    .map((p) => {
      const share = p.agentSharePct;
      return `<tr><td class="path">${esc(p.path)}</td><td class="n">${fmt(p.agentRequests)}</td><td class="n">${fmt(p.humanRequests)}</td><td><span class="sharebar"><i style="width:${share.toFixed(0)}%"></i></span><span class="n">${share.toFixed(1)}%</span></td></tr>`;
    })
    .join("");
  const table = `<div class="scroll"><table><thead><tr><th>Path</th><th>Agent requests</th><th>Human requests</th><th>Agent share</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return mod("Top pages by agent demand", table);
}

function deadEnds(result: AnalysisResult): string {
  const dead = result.failures.filter((f) => f.type === "dead_end").slice(0, 6);
  const chart =
    dead.length > 0
      ? hbarSvg({
          items: dead.map((f: FailureFinding) => ({
            label: f.path,
            value: f.agentHits,
            color: "#c73a2e",
          })),
          xMax: niceCeil(Math.max(1, ...dead.map((f) => f.agentHits))),
          xTicks: 4,
          xLab: "Agent requests answered 404/410",
          aria: "Agent requests that returned 404, by path",
        })
      : `<div class="footnote">No agent dead ends in this window.</div>`;

  const t = result.failureTotals;
  const shellAvailable = coveragePresent(result, "response bytes");
  const emptyShellCard = el(
    "div",
    { class: `failcard h${shellAvailable ? "" : " greyed"}` },
    shellAvailable
      ? `<div class="t">Empty-shell pages ${heurChip()}</div><div class="v num">${fmt(t.empty_shell)}</div><div class="d">HTML shells with almost no content, fetched by agents</div>`
      : `<div class="t">Empty-shell pages ${heurChip()}</div><div class="v num">—</div><div class="d greyed-note">Needs the response-bytes signal (not in this source)</div>`,
  );
  const authCard = `<div class="failcard"><div class="t">Auth walls</div><div class="v num">${fmt(t.auth_wall)}</div><div class="d">401/403 responses to agent requests</div></div>`;
  const retryCard = `<div class="failcard"><div class="t">Retry loops</div><div class="v num">${fmt(t.retry_loop)}</div><div class="d">≥3 identical fetches within 60 s</div></div>`;
  const cards = `<div class="failcards">${emptyShellCard}${authCard}${retryCard}</div>`;
  const spoofNote =
    result.spoofedRequests > 0
      ? `<div class="callout">⚠ ${fmt(result.spoofedRequests)} request(s) impersonated a verifiable crawler (e.g. Googlebot) — caught by IP verification and reclassified as agents.</div>`
      : "";
  return mod("Where agents hit dead ends", `<div class="chart">${chart}</div>${cards}${spoofNote}`);
}

function recommendations(result: AnalysisResult): string {
  if (result.recommendations.length === 0 && !result.llmsTxt) {
    return mod(
      "Recommended fixes",
      `<div class="footnote">No fixes recommended for this window.</div>`,
    );
  }
  const list = result.recommendations
    .map(
      (rec) =>
        `<li><span class="rec-t">${esc(rec.title)}${rec.heuristic ? ` ${heurChip()}` : ""}</span><span class="rec-d" style="margin-left:auto">${esc(rec.detail)}</span></li>`,
    )
    .join("");
  const draft = result.llmsTxt
    ? `<pre class="code"><span class="c"># /llms.txt — draft generated from observed agent demand</span>\n${esc(result.llmsTxt.trim())}</pre>`
    : "";
  return mod("Recommended fixes", `<ol class="recs">${list}</ol>${draft}`);
}

function coverage(result: AnalysisResult): string {
  const rows = result.coverage
    .map((r) => {
      const pill = r.present
        ? `<span class="pill ok">present</span>`
        : `<span class="pill crit">missing</span>`;
      return `<tr><td class="field">${esc(r.field)}</td><td>${pill}</td><td>${esc(r.unlocks)}</td></tr>`;
    })
    .join("");
  const table = `<div class="scroll"><table><thead><tr><th>Signal</th><th>Status</th><th>Unlocks</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const realtime = coveragePresent(result, "real-time delivery");
  const callout = realtime
    ? ""
    : `<div class="callout"><b>Install the snippet</b> to capture every signal in real time — one middleware file, observe-only, fails open.</div>`;
  return mod("Coverage — what this source provides", `${table}${callout}`);
}

function footer(opts: ReportOptions): string {
  const a = opts.accuracy;
  const accLine = a
    ? `<div class="acc">Classifier accuracy (labeled corpus): overall ${(a.overallAccuracy * 100).toFixed(1)}% · Tier-1 UA precision ${(a.tier1Precision * 100).toFixed(1)}% · ${(a.unclassifiedRate * 100).toFixed(1)}% unclassified (never force-assigned).</div>`
    : "";
  const gen = opts.generatedAt ? ` · generated ${esc(opts.generatedAt)}` : "";
  const build = opts.buildHash ? ` · build ${esc(opts.buildHash)}` : "";
  return el(
    "footer",
    {},
    `${accLine}<div>Footfall — agent-experience analytics. Behavioral classification is imperfect; heuristic signals are flagged and unclassified traffic is never guessed.${gen}${build}</div><div>Independent open-source project; not affiliated with any hosting provider or agent vendor.</div>`,
  );
}

/** Render an AnalysisResult into a self-contained static HTML report (Log Report). */
export function renderReport(result: AnalysisResult, opts: ReportOptions = {}): string {
  const siteName = opts.siteName ?? result.meta.site;
  const body = [
    `<div class="masthead"><div class="brand"><span class="steps">👣</span> Footfall</div><div class="sub">${esc(siteName)} · ${esc(result.meta.source)} export</div></div>`,
    reportHead(result, siteName),
    whoIsVisiting(result),
    agentFamilies(result),
    topPages(result),
    deadEnds(result),
    recommendations(result),
    coverage(result),
    footer(opts),
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Footfall — ${esc(siteName)} agent traffic report</title>
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
${body}
</div>
</body>
</html>
`;
}
