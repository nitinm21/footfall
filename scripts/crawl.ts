/**
 * crawl.ts — the naive-crawler client (Phase 1 helper).
 *
 * GETs every known URL once with a bot UA and no JavaScript, including probe
 * paths that don't exist (/llms.txt, /openapi.json, …). Produces the "crawler"
 * ground truth: breadth-first, 0% assets, lots of 404 demand signals.
 *
 * Usage: tsx scripts/crawl.ts [baseUrl]   (default http://localhost:4000)
 */

const base = process.argv[2] ?? "http://localhost:4000";
const paths = [
  "/",
  "/docs/intro",
  "/docs/guide",
  "/docs/interactive",
  "/docs/private",
  "/docs/old-intro",
  "/llms.txt",
  "/llms-full.txt",
  "/openapi.json",
  "/sitemap.xml",
  "/docs/guide.md",
  "/robots.txt",
];

for (const path of paths) {
  await fetch(base + path, {
    headers: { "user-agent": "AcmeDocsBot/1.0 (+https://acme.example/bot)" },
  }).catch(() => {
    /* record the attempt regardless of transport errors */
  });
}
console.log(`crawl: fetched ${paths.length} url(s) at ${base}`);
