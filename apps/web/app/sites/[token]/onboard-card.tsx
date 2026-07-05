"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The GA-snippet-equivalent first mile: show one personalized install command with a copy button,
 * then poll for the first event and flip green + reveal the dashboard when it arrives.
 */
export function OnboardCard({ token }: { token: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState(false);
  const command = `npx footfall init ${token}`;

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; the command is still visible to copy manually */
    }
  };

  return (
    <section className="mod" data-testid="onboard-card">
      <div className="modhead">
        <h2>Install Footfall on {token}</h2>
      </div>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Run this in your Next.js project. It wraps your middleware (observe-only, fails open), wires
        the 5xx beacon, and writes your token — reviewable as one{" "}
        <span className="mono">git diff</span>.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
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
        <button type="button" className="markbtn" onClick={copy} style={{ padding: "0 14px" }}>
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
        Then set <span className="mono">FOOTFALL_TOKEN={token}</span> on your host and deploy.
      </p>

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
