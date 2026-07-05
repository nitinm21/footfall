"use client";

import { useEffect, useState } from "react";

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * "last event Ns ago" via polling (the plan's chosen approach — no websockets). Fixture/demo
 * sites are static sample data, so they show a "sample data" chip instead of a live dot.
 */
export function LiveDot({ token, source }: { token: string; source: string }) {
  const [state, setState] = useState<{ lastEventTs: number | null; now: number } | null>(null);

  useEffect(() => {
    if (source !== "live") return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/sites/${token}/last-event`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { lastEventTs: number | null; now: number };
        if (active) setState(j);
      } catch {
        /* fail quiet — the dashboard itself is unaffected */
      }
    };
    void poll();
    const id = setInterval(poll, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, source]);

  if (source !== "live") {
    return (
      <span className="live-dot" style={{ color: "var(--muted)" }} data-testid="live-indicator">
        sample data
      </span>
    );
  }

  const label = state?.lastEventTs
    ? `last event ${ago(state.now - state.lastEventTs)}`
    : "waiting for first event…";
  return (
    <>
      <span className="live-dot" data-testid="live-indicator">
        <i /> live
      </span>
      <span className="right">{label}</span>
    </>
  );
}
