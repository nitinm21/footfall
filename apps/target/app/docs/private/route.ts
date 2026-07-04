/**
 * The auth-wall failure mode. A real docs site would gate this behind a session;
 * here we always return 403 so agent traffic reliably hits an auth wall (401/403).
 * Implemented as a Route Handler so we can set the status code directly.
 */
const BODY = `<!doctype html>
<html lang="en">
  <head><title>403 — API keys</title></head>
  <body>
    <h1>403 — Members only</h1>
    <p>Creating an API key requires a signed-in Acme account.</p>
  </body>
</html>`;

export function GET() {
  return new Response(BODY, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
