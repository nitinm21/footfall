/**
 * probe.ts — the outside-in probe (Phase 4).
 *
 * The live middleware can't see response status/bytes, and a not-found.tsx beacon
 * over-fires (Next renders that boundary on every request). So the reliable source of
 * truth for 404s and empty shells is to fetch the top agent-requested paths *agent-style*
 * (no JS, markdown-preferring) from outside and read the real status + byte size.
 *
 * Usage:
 *   tsx scripts/probe.ts --base https://site.com --paths /,/docs/intro,/llms.txt \
 *     [--site X] [--out probe.jsonl]
 * Emits schema-valid Event JSONL (real status + resp_bytes) — feed it to the pipeline
 * so dead_end and empty_shell detection work on the live site.
 */

import { appendFileSync } from "node:fs";
import { EVENT_VERSION, type Event } from "@footfall/core/schema";

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
}

const ASSET_EXT = /\.(css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;

async function main(): Promise<void> {
  const base = arg("--base");
  if (!base) {
    console.error("probe: --base <url> is required");
    process.exit(1);
  }
  const paths = arg("--paths")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const site = arg("--site", "probe");
  const out = arg("--out");
  const nowMs = Date.now();

  const events: Event[] = [];
  for (const path of paths) {
    let status: number | null = null;
    let bytes: number | null = null;
    let contentType: string | null = null;
    try {
      const res = await fetch(base + path, {
        headers: { "user-agent": "footfall-probe/1.0", accept: "text/markdown,text/html;q=0.9" },
        redirect: "manual",
      });
      status = res.status;
      contentType = res.headers.get("content-type");
      bytes = new TextEncoder().encode(await res.text()).length;
    } catch {
      // unreachable path → leave status null
    }
    events.push({
      v: EVENT_VERSION,
      ts: nowMs,
      site,
      method: "GET",
      path,
      has_query: false,
      status,
      resp_bytes: bytes,
      content_type: contentType,
      duration_ms: null,
      ua: "footfall-probe/1.0",
      accept: "text/markdown,text/html;q=0.9",
      sec_fetch_mode: null,
      referer_host: null,
      conditional: false,
      ip_hash: "probe",
      asset: path.startsWith("/_next/static") || ASSET_EXT.test(path),
    });
    console.log(
      `  ${String(status ?? "ERR").padEnd(4)} ${String(bytes ?? "-").padStart(6)}b  ${path}`,
    );
  }

  const jsonl = `${events.map((e) => JSON.stringify(e)).join("\n")}\n`;
  if (out) {
    appendFileSync(out, jsonl);
    console.log(`probe: wrote ${events.length} events to ${out}`);
  }
}

await main();
