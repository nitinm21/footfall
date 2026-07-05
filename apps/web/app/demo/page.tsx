import { headers } from "next/headers";
import { rateLimit } from "../../lib/ratelimit";
import { buildDemoDashboard } from "../../src/demo";
import { Dashboard } from "../sites/[token]/dashboard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Live demo · Footfall",
  description: "A read-only Footfall dashboard on sample agent-traffic data.",
};

export default async function DemoPage() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "anon";
  if (!rateLimit(`demo:${ip}`, 30, 60_000)) {
    return (
      <main className="wrap" style={{ maxWidth: 520 }}>
        <section className="mod">
          <div className="modhead">
            <h2>Slow down 🙂</h2>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Too many requests to the public demo — try again in a moment.
          </p>
        </section>
      </main>
    );
  }

  const data = buildDemoDashboard(Date.now());
  return <Dashboard data={data} sites={[]} userName={null} readOnly />;
}
