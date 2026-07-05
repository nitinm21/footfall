import type { ClassifiedSession } from "@footfall/core";
import { fmt, hbarSvg, lineChartSvg } from "@footfall/report";
import { signOut } from "../../../auth";
import type { Site } from "../../../db/schema";
import {
  CLASS_COLOR,
  dateRange,
  FAILURE_LABEL,
  familyColor,
  familyLabel,
  fmtDate,
  niceCeil,
  shortDay,
} from "../../../lib/viz";
import type { DashboardData } from "../../../src/dashboard-data";
import { markFixDeployed } from "./actions";
import { LiveDot } from "./live-dot";
import { OnboardCard } from "./onboard-card";

// ── small helpers ─────────────────────────────────────────────────────────────

function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function duration(s: ClassifiedSession): string {
  const sec = Math.max(0, Math.round((s.end - s.start) / 1000));
  return sec < 90 ? `${sec}s` : `${Math.round(sec / 60)}m`;
}

function journey(s: ClassifiedSession): string {
  const seen: string[] = [];
  for (const e of s.events) {
    if (!seen.includes(e.path)) seen.push(e.path);
    if (seen.length >= 4) break;
  }
  return seen.slice(0, 3).join(" → ") + (seen.length > 3 ? " → …" : "");
}

function sessionFailures(s: ClassifiedSession): number {
  return s.events.filter((e) => e.status !== null && e.status >= 400).length;
}

function confidencePill(confidence: string): { cls: string; label: string } {
  if (confidence === "high") return { cls: "ok", label: "high" };
  if (confidence === "medium") return { cls: "warn", label: "med" };
  return { cls: "mut", label: "low" };
}

interface DeltaView {
  cls: string;
  text: string;
}

function delta(
  cur: number,
  prev: number | null,
  kind: "count" | "pts",
  lowerIsBetter = false,
): DeltaView {
  if (prev === null) return { cls: "flat", text: "new" };
  const diff = cur - prev;
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "→";
  const magnitude =
    kind === "pts"
      ? `${Math.abs(diff).toFixed(1)} pts`
      : prev === 0
        ? "—"
        : `${Math.abs(Math.round((diff / prev) * 100))}%`;
  const favorable = lowerIsBetter ? diff < 0 : diff > 0;
  const cls = diff === 0 ? "flat" : favorable ? (lowerIsBetter ? "down" : "up") : "bad";
  return { cls, text: `${arrow} ${magnitude} vs prior 14d` };
}

function Kpi({
  lab,
  value,
  suffix,
  d,
  testid,
}: {
  lab: string;
  value: string;
  suffix?: string;
  d: DeltaView;
  testid: string;
}) {
  return (
    <div className="kpi">
      <div className="lab">{lab}</div>
      <div className="val num" data-testid={testid}>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </div>
      <div className={`delta ${d.cls}`}>{d.text}</div>
    </div>
  );
}

// ── the dashboard ───────────────────────────────────────────────────────────

export function Dashboard({
  data,
  sites,
  userName,
}: {
  data: DashboardData;
  sites: Site[];
  userName: string | null;
}) {
  const { result, kpis, prev } = data;
  const token = data.site.token;

  // Receipts showcase the classifier's range: one session per distinct family, agents first
  // (the interesting cases), then crawlers/humans — richest session within each family.
  const receiptSessions = (() => {
    const classified = result.sessions.filter((s) => s.classification.tier !== null);
    const rank = (s: ClassifiedSession) =>
      s.classification.class === "agent" ? 0 : s.classification.class === "crawler" ? 1 : 2;
    const ordered = classified.sort(
      (a, b) => rank(a) - rank(b) || b.events.length - a.events.length,
    );
    const seen = new Set<string>();
    const picked: ClassifiedSession[] = [];
    for (const s of ordered) {
      const fam = s.classification.family ?? s.classification.class;
      if (seen.has(fam)) continue;
      seen.add(fam);
      picked.push(s);
      if (picked.length >= 5) break;
    }
    for (const s of ordered) {
      if (picked.length >= 5) break;
      if (!picked.includes(s)) picked.push(s);
    }
    return picked;
  })();

  const recent = [...result.sessions]
    .filter((s) => s.classification.class === "agent")
    .sort((a, b) => b.end - a.end)
    .slice(0, 8);

  const days = result.daily;
  const maxVal = Math.max(1, ...days.flatMap((dd) => [dd.human, dd.agent, dd.crawler]));
  const lineSvg = lineChartSvg({
    aria: "Requests per day by visitor class",
    labels: days.map((dd) => shortDay(dd.date)),
    yMax: niceCeil(maxVal),
    yTicks: 4,
    tickEvery: days.length <= 8 ? 1 : Math.ceil(days.length / 7),
    xLab: "Date",
    yLab: "Requests per day",
    series: [
      { name: "Humans", color: CLASS_COLOR.human, values: days.map((dd) => dd.human) },
      {
        name: "AI agents",
        color: CLASS_COLOR.agent,
        endLabel: true,
        values: days.map((dd) => dd.agent),
      },
      {
        name: "Crawlers",
        color: CLASS_COLOR.crawler,
        dash: "4 4",
        values: days.map((dd) => dd.crawler),
      },
    ],
  });

  const famItems = result.families.map((f) => ({
    // no heuristic suffix here — the "⚠" note beside the bar + the footnote already flag it,
    // and the short label avoids clipping in the narrow chart gutter
    label: familyLabel(f.family),
    value: f.requests,
    color: familyColor(f.family),
    ...(f.heuristic ? { note: "⚠" } : {}),
  }));
  const famSvg = famItems.length
    ? hbarSvg({
        items: famItems,
        xMax: niceCeil(Math.max(1, ...famItems.map((i) => i.value))),
        xTicks: 4,
        xLab: "Agent requests",
        aria: "Agent requests by family",
        W: 500,
        labW: 168,
        valW: 64,
      })
    : null;

  const anyHeur = result.families.some((f) => f.heuristic);
  const fi = data.fixImpact;

  return (
    <main className="wrap">
      <div className="masthead">
        <div className="brand">
          <span className="steps">👣</span> Footfall
        </div>
        <span className="sub">{userName ? `signed in as ${userName}` : null}</span>
        <span className="right" style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
          {sites.length > 1 ? (
            <a className="linkbtn" href="/">
              all sites
            </a>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="linkbtn"
              style={{ border: 0, background: "none", cursor: "pointer" }}
            >
              sign out
            </button>
          </form>
        </span>
      </div>

      <div className="toolbar">
        <span className="site" data-testid="site-name">
          {data.site.name}
        </span>
        <span className="sel">{dateRange(data.from, data.to)}</span>
        <LiveDot token={token} source={data.site.source} />
      </div>

      {data.isEmpty ? (
        data.site.source === "live" ? (
          // A live site with no events yet → the onboarding first-mile (install + listening).
          <OnboardCard token={token} />
        ) : (
          <section className="mod" data-testid="empty-state">
            <div className="modhead">
              <h2>No traffic in this window yet</h2>
            </div>
            <p style={{ color: "var(--muted)", marginTop: 0 }}>
              Once the snippet starts sending events for <span className="mono">{token}</span>,
              agent sessions, failures, and fix impact will appear here. Nothing to classify yet —
              and we never invent numbers.
            </p>
          </section>
        )
      ) : (
        <>
          <div className="kpis">
            <Kpi
              lab="Agent requests · 14d"
              value={fmt(kpis.agentRequests)}
              d={delta(kpis.agentRequests, prev?.agentRequests ?? null, "count")}
              testid="kpi-agent-requests"
            />
            <Kpi
              lab="Agent share of all traffic"
              value={String(kpis.agentSharePct)}
              suffix="%"
              d={delta(kpis.agentSharePct, prev?.agentSharePct ?? null, "pts")}
              testid="kpi-agent-share"
            />
            <Kpi
              lab="Agent sessions"
              value={fmt(kpis.agentSessions)}
              d={delta(kpis.agentSessions, prev?.agentSessions ?? null, "count")}
              testid="kpi-agent-sessions"
            />
            <Kpi
              lab="Failed agent requests"
              value={fmt(kpis.failedAgentRequests)}
              d={delta(kpis.failedAgentRequests, prev?.failedAgentRequests ?? null, "count", true)}
              testid="kpi-failed"
            />
          </div>

          {data.sampledDropped > 0 ? (
            <div className="callout" data-testid="sampling-notice">
              ⚠ {fmt(data.sampledDropped)} event(s) were sampled away this period after hitting the
              daily ingest cap — counts below are a lower bound. Raise the cap or reduce volume.
            </div>
          ) : null}

          <section className="mod" data-testid="mod-traffic">
            <div className="modhead">
              <h2>Traffic by visitor class</h2>
            </div>
            <div className="chart" dangerouslySetInnerHTML={{ __html: lineSvg }} />
            <div className="legend">
              <span>
                <span className="sw" style={{ background: CLASS_COLOR.human }} />
                Humans
              </span>
              <span>
                <span className="sw" style={{ background: CLASS_COLOR.agent }} />
                AI agents
              </span>
              <span>
                <span className="sw" style={{ background: CLASS_COLOR.crawler }} />
                Crawlers
              </span>
            </div>
          </section>

          <div className="split2">
            <section className="mod" style={{ marginBottom: 20 }} data-testid="mod-families">
              <div className="modhead">
                <h2>Agent families · 14d</h2>
              </div>
              {famSvg ? (
                <div className="chart" dangerouslySetInnerHTML={{ __html: famSvg }} />
              ) : (
                <div className="footnote">No agent traffic classified in this window.</div>
              )}
              {anyHeur ? (
                <div className="footnote">
                  ⚠ Behavioral estimate — no distinguishing user-agent; family inferred from
                  behavior.
                </div>
              ) : null}
            </section>

            <section className="mod" style={{ marginBottom: 20 }} data-testid="mod-receipts">
              <div className="modhead">
                <h2>Classification receipts</h2>
              </div>
              {receiptSessions.length === 0 ? (
                <div className="footnote">No classified sessions in this window.</div>
              ) : (
                receiptSessions.map((s) => {
                  const pill = confidencePill(s.classification.confidence);
                  return (
                    <div className="receipt" key={s.id}>
                      <div className="head">
                        <span>
                          Session <span className="mono">#{s.id.slice(0, 6)}</span> →{" "}
                          {familyLabel(
                            s.classification.family ?? s.classification.class,
                            s.classification.heuristic,
                          )}
                        </span>
                        <span className={`pill ${pill.cls}`}>{pill.label} confidence</span>
                      </div>
                      <ul>
                        {s.classification.receipt.signals.map((sig, i) => (
                          <li className={`sig${sig.present ? "" : " miss"}`} key={`${s.id}-${i}`}>
                            {sig.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </section>
          </div>

          <section className="mod" data-testid="mod-failures">
            <div className="modhead">
              <h2>Failure feed</h2>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Failure</th>
                    <th>Agent hits · 14d</th>
                    <th>Trend</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failureFeed.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ color: "var(--muted)" }}>
                        No agent-facing failures detected in this window. 🎉
                      </td>
                    </tr>
                  ) : (
                    data.failureFeed.map((f) => {
                      const trendArrow =
                        f.trend === "resolved"
                          ? "▼ 100%"
                          : f.trend === "up"
                            ? "▲"
                            : f.trend === "down"
                              ? "▼"
                              : "→";
                      return (
                        <tr key={`${f.type}-${f.path}`}>
                          <td className="path">{f.path}</td>
                          <td>
                            <span
                              className={`pill ${f.type === "auth_wall" || f.heuristic ? "warn" : "crit"}`}
                            >
                              {FAILURE_LABEL[f.type] ?? f.type}
                            </span>
                          </td>
                          <td className="n">{fmt(f.agentHits)}</td>
                          <td className="n">{trendArrow}</td>
                          <td>
                            {f.status === "fix_live" ? (
                              <span className="pill ok">
                                fix live{f.fixedAt ? ` · ${fmtDate(f.fixedAt)}` : ""}
                              </span>
                            ) : (
                              <form action={markFixDeployed} style={{ display: "inline" }}>
                                <input type="hidden" name="token" value={token} />
                                <input type="hidden" name="path" value={f.path} />
                                <input type="hidden" name="type" value={f.type} />
                                <button type="submit" className="markbtn">
                                  mark fix deployed
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mod" data-testid="mod-fiximpact">
            <div className="modhead">
              <h2>
                Fix impact{fi ? " — " : ""}
                {fi ? <span className="mono">{fi.path}</span> : null}
                {fi ? ` shipped ${fmtDate(fi.deployedAt)}` : ""}
              </h2>
            </div>
            {fi ? (
              <div className="beforeafter">
                <div className="ba">
                  <div className="lab">Failures · {fi.windowDays}d before</div>
                  <div className="val num">{fmt(fi.beforeFailures)}</div>
                  <div className="bar" style={{ width: 150 }} />
                </div>
                <div className="ba">
                  <div className="lab">Failures · {fi.windowDays}d after</div>
                  <div className={`val num${fi.afterFailures === 0 ? " good" : ""}`}>
                    {fmt(fi.afterFailures)}
                  </div>
                  <div
                    className={`bar${fi.afterFailures === 0 ? " zero" : ""}`}
                    // zero bars get their fixed width from CSS; non-zero scale to the before-bar
                    style={
                      fi.afterFailures === 0
                        ? undefined
                        : {
                            width: Math.round(
                              (fi.afterFailures / Math.max(1, fi.beforeFailures)) * 150,
                            ),
                          }
                    }
                  />
                </div>
                <div className="ba">
                  <div className="lab">Successful fetches since</div>
                  <div className="val num">{fmt(fi.successAfter)}</div>
                </div>
              </div>
            ) : (
              <div className="footnote">
                Mark a failing path as “fix deployed” in the feed above to track its before/after
                impact here.
              </div>
            )}
          </section>

          <section className="mod" data-testid="mod-sessions">
            <div className="modhead">
              <h2>Recent agent sessions</h2>
            </div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Family</th>
                    <th>Requests</th>
                    <th>Journey</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ color: "var(--muted)" }}>
                        No agent sessions in this window.
                      </td>
                    </tr>
                  ) : (
                    recent.map((s) => {
                      const pill = confidencePill(s.classification.confidence);
                      const fails = sessionFailures(s);
                      return (
                        <tr key={s.id}>
                          <td className="n">{clock(s.end)}</td>
                          <td>
                            {familyLabel(
                              s.classification.family ?? "agent",
                              s.classification.heuristic,
                            )}{" "}
                            <span className={`pill ${pill.cls}`}>{pill.label}</span>
                          </td>
                          <td className="n">
                            {s.events.length} / {duration(s)}
                          </td>
                          <td className="path">{journey(s)}</td>
                          <td>
                            {fails > 0 ? (
                              <span className="pill crit">{fails}× 4xx</span>
                            ) : (
                              <span className="pill ok">clean</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <footer>
        Footfall — agent-experience analytics. Behavioral classification is imperfect; heuristic
        signals are flagged and unclassified traffic is never guessed.
      </footer>
    </main>
  );
}
