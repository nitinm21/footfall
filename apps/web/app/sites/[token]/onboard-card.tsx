"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { agentInstructions, DEFAULT_INGEST_URL } from "../../../lib/agent-instructions";

/**
 * The GA-snippet-equivalent first mile. Two ways to install — run it yourself, or hand a
 * token-filled task to your AI coding agent — then poll for the first event and flip green.
 * Scope is Next.js / Vercel only (v1); stated up front.
 */
export function OnboardCard({ token }: { token: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"" | "cmd" | "agent">("");
  const [detected, setDetected] = useState(false);
  const command = `npx footfall init ${token}`;
  const agentTask = agentInstructions(token);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(token)}/last-event`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { lastEventTs: number | null };
        if (j.lastEventTs && active) {
          setDetected(true);
          setTimeout(() => router.refresh(), 1800);
        }
      } catch {
        /* keep polling */
      }
    };
    void poll();
    const id = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, router]);

  const copy = async (what: "cmd" | "agent", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard may be blocked; text is still selectable */
    }
  };

  return (
    <section className="mod" data-testid="onboard-card">
      <div className="modhead">
        <h2>Install Footfall on {token}</h2>
        <span className="chip" style={{ background: "var(--accent-soft)", color: "#2b3568" }}>
          Next.js / Vercel only (v1)
        </span>
      </div>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Observe-only and fails open — never blocks or delays a response, no cookies, no bodies. Not
        on Next.js/Vercel? Send a log export for a static report instead (see{" "}
        <a href="/docs">docs</a>).
      </p>

      {/* Option 1 — run it yourself */}
      <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 6px" }}>Run it yourself</div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <code
          className="mono"
          style={{
            flex: 1,
            background: "var(--ink)",
            color: "#d6dae2",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
            overflowX: "auto",
          }}
        >
          {command}
        </code>
        <button
          type="button"
          className="markbtn"
          onClick={() => copy("cmd", command)}
          style={{ padding: "0 14px" }}
        >
          {copied === "cmd" ? "copied ✓" : "copy"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
        Then set <span className="mono">FOOTFALL_TOKEN={token}</span> and{" "}
        <span className="mono">FOOTFALL_INGEST_URL={DEFAULT_INGEST_URL}</span> on Vercel, deploy,
        and run <span className="mono">npx footfall check {token}</span>.
      </p>

      {/* Option 2 — hand it to your agent */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 6px" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🤖 Or hand it to your AI agent</span>
        <button type="button" className="markbtn" onClick={() => copy("agent", agentTask)}>
          {copied === "agent" ? "copied ✓" : "copy instructions"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 6px" }}>
        Paste this into Claude Code / Cursor. The token is already filled in; it installs and
        verifies autonomously (and asks you before deploying).
      </p>
      <pre
        className="mono"
        style={{
          background: "var(--ink)",
          color: "#d6dae2",
          borderRadius: 8,
          padding: "14px 16px",
          fontSize: 12,
          lineHeight: 1.6,
          overflowX: "auto",
          maxHeight: 260,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {agentTask}
      </pre>

      <div
        className="callout"
        data-testid="listening"
        style={
          detected
            ? {
                background: "var(--ok-soft)",
                color: "#1f6b40",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }
            : { display: "flex", alignItems: "center", gap: 8 }
        }
      >
        {detected ? (
          <>
            <span className="live-dot">
              <i />
            </span>
            First event received — loading your dashboard…
          </>
        ) : (
          <>
            <span className="live-dot" style={{ color: "var(--muted)" }}>
              <i style={{ background: "var(--muted)" }} />
            </span>
            Listening for your first event…
          </>
        )}
      </div>
    </section>
  );
}
