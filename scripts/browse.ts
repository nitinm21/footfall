/**
 * browse.ts — drive a real Chromium through the capture proxy (Phase 1 helper).
 *
 * Produces the "human-browser" ground truth: a real browser engine fetches each
 * page plus its CSS/JS/image assets and sends browser headers (UA, sec-fetch-*),
 * so these traces have a high asset ratio — the opposite of an agent's.
 *
 * Usage: tsx scripts/browse.ts [baseUrl]   (default http://localhost:4000)
 */

import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4000";
const paths = [
  "/",
  "/docs/intro",
  "/docs/guide",
  "/docs/interactive",
  "/docs/old-intro", // a human following a stale link -> 404
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const path of paths) {
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {
    /* 404s reject navigation in some cases; the request is still captured */
  });
}
await browser.close();
console.log(`browse: visited ${paths.length} page(s) at ${base}`);
