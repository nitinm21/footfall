export const dynamic = "force-dynamic";

/**
 * Footfall's own /llms.txt — we ship the exact fix we recommend to customers. It gives an agent
 * the one-line pitch and where to go to install. (Public; the middleware matcher skips it.)
 */
export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const body = `# Footfall

> Agent-experience analytics — see which AI agents (Claude Code, Cursor, Codex, crawlers) visit
> your site and where they fail (404s, auth walls, empty JS shells, retry loops), then fix it from
> observed demand. Observe-only, fails open, no cookies. v1 supports Next.js apps on Vercel.

## Install (Next.js / Vercel)
- Add your site in the dashboard to get a token, then run: \`npx footfall init <your-token>\`
- Verify the round-trip: \`npx footfall check <your-token>\`
- Full agent-ready, copy-paste install instructions appear next to your token after you add a site.

## Docs
- [Install & privacy](${origin}/docs): exactly what is and isn't collected, and the fail-open design.

## Not on Next.js/Vercel?
- Send a Vercel log-drain export or JSONL and get a static report instead — no install required.

## Notes
- Honest by design: no invented "success score"; heuristic signals are flagged; traffic that can't
  be classified confidently stays in an \`unclassified\` bucket; every classification shows its receipts.
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
