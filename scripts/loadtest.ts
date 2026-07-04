/**
 * loadtest.ts — the fail-open proof (Phase 4).
 *
 * autocannon against `apps/target` in four conditions: baseline (middleware inert),
 * and middleware-active with the ingest HEALTHY, DOWN, and SLOW (2s). The middleware
 * fire-and-forgets via waitUntil with a hard timeout, so response latency and error
 * rate must be unaffected by ingest health. Asserts Δp99 vs baseline < THRESHOLD and
 * zero added non-2xx in every case.
 *
 * Runs locally (not in CI). Requires `apps/target` to be built.
 */

import { type ChildProcess, spawn } from "node:child_process";
import http from "node:http";

const TARGET_PORT = 3000;
const INGEST_PORT = 4100;
const URL = `http://localhost:${TARGET_PORT}/docs/intro`;
const P99_THRESHOLD_MS = 10;
const CONNECTIONS = 20;
const DURATION = 6;

type Mode = "healthy" | "slow" | "down";
let ingestMode: Mode = "healthy";

const mockIngest = http.createServer((req, res) => {
  if (ingestMode === "down") {
    req.socket.destroy();
    return;
  }
  const reply = () => {
    res.writeHead(202);
    res.end("ok");
  };
  if (ingestMode === "slow") setTimeout(reply, 2000);
  else reply();
});

function waitForPort(port: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = http
        .get({ host: "localhost", port, path: "/" }, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error(`port ${port} not up`));
          else setTimeout(tick, 250);
        });
      sock.end();
    };
    tick();
  });
}

async function startTarget(env: Record<string, string>): Promise<ChildProcess> {
  const proc = spawn("pnpm", ["--filter", "@footfall/target", "start"], {
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  await waitForPort(TARGET_PORT);
  return proc;
}

async function stop(proc: ChildProcess): Promise<void> {
  proc.kill("SIGKILL");
  await new Promise((r) => setTimeout(r, 500));
}

async function bench(label: string): Promise<{ label: string; p99: number; non2xx: number }> {
  const { default: autocannon } = await import("autocannon");
  const result = await autocannon({ url: URL, connections: CONNECTIONS, duration: DURATION });
  return { label, p99: result.latency.p99, non2xx: result.non2xx + result.errors };
}

async function main(): Promise<void> {
  mockIngest.listen(INGEST_PORT);
  const results: { label: string; p99: number; non2xx: number }[] = [];

  // Baseline: middleware inert.
  let target = await startTarget({ FOOTFALL_DISABLED: "1" });
  const baseline = await bench("baseline (no middleware)");
  results.push(baseline);
  await stop(target);

  // Active: middleware on, vary ingest health.
  target = await startTarget({
    FOOTFALL_TOKEN: "loadtest-site",
    FOOTFALL_INGEST_URL: `http://localhost:${INGEST_PORT}/api/ingest`,
    FOOTFALL_IP_SALT: "salt",
    FOOTFALL_DISABLED: "",
  });
  for (const mode of ["healthy", "down", "slow"] as Mode[]) {
    ingestMode = mode;
    results.push(await bench(`middleware + ingest ${mode.toUpperCase()}`));
  }
  await stop(target);
  mockIngest.close();

  // Report + assert.
  console.log("\nscenario                        p99(ms)   Δp99   non2xx");
  console.log("------------------------------  -------  ------  ------");
  const problems: string[] = [];
  for (const r of results) {
    const d = r.p99 - baseline.p99;
    const dStr = r.label === baseline.label ? "  —  " : `${d >= 0 ? "+" : ""}${d.toFixed(1)}`;
    console.log(
      `${r.label.padEnd(30)}  ${String(r.p99).padStart(7)}  ${dStr.padStart(6)}  ${String(r.non2xx).padStart(6)}`,
    );
    if (r.non2xx > baseline.non2xx)
      problems.push(`${r.label}: ${r.non2xx} non-2xx (baseline ${baseline.non2xx})`);
    if (r.label !== baseline.label && d > P99_THRESHOLD_MS) {
      problems.push(`${r.label}: Δp99 ${d.toFixed(1)}ms > ${P99_THRESHOLD_MS}ms`);
    }
  }
  console.log("");
  if (problems.length) {
    console.error("FAIL — fail-open assertions:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `OK — middleware never added >${P99_THRESHOLD_MS}ms p99 or any error, in any ingest condition.`,
  );
}

await main();
