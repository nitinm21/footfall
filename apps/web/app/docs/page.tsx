// Public install + privacy page — the recruit-facing one-pager (mirrors docs/privacy.md).
// Public by design: the middleware's `authorized` callback only gates "/" and "/sites/*".

export const metadata = { title: "Install & Privacy · Footfall" };

const COLLECTS = [
  "Method, path (query string dropped — only a has_query boolean is kept)",
  "Status, response bytes, response time (when the source provides them)",
  "User-Agent, Accept, Sec-Fetch-*, and referer host (not the full referer)",
  "Whether the request was conditional (If-None-Match / If-Modified-Since)",
  "A salted hash of the IP (salt rotates daily) — for session stitching only",
  "Whether the request was for a static asset; and, for self-declared crawlers, whether the IP verified",
];

const NEVER = [
  "No cookies",
  "No request or response bodies",
  "No raw IP addresses — only a daily-rotating salted hash",
  "No query strings, so no tokens or PII smuggled in URLs",
  "No cross-site tracking, ad identifiers, or fingerprinting",
];

export default function DocsPage() {
  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div className="masthead">
        <div className="brand">
          <span className="steps">👣</span> Footfall
        </div>
        <span className="sub">Install &amp; privacy</span>
      </div>

      <section className="mod">
        <div className="modhead">
          <h2>Install in one command</h2>
        </div>
        <pre
          className="code"
          style={{
            background: "var(--ink)",
            color: "#d6dae2",
            borderRadius: 8,
            padding: "14px 16px",
            overflowX: "auto",
            fontSize: 13,
          }}
        >
          {`npx footfall init <your-token>   # wraps middleware + wires the 5xx beacon (one reviewable diff)
# set FOOTFALL_TOKEN=<your-token> on your host, deploy, then:
npx footfall check <your-token>  # confirms the event round-trip end-to-end`}
        </pre>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Observe-only and fail-open: the middleware never blocks, delays, redirects, or modifies a
          response. Capture runs after the response is sent, with a hard 500&nbsp;ms timeout and all
          failures swallowed — if Footfall is down, your site is unaffected.
        </p>
      </section>

      <div className="split2">
        <section className="mod" style={{ marginBottom: 20 }}>
          <div className="modhead">
            <h2>What it collects</h2>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13.5,
              color: "#3d434c",
              lineHeight: 1.7,
            }}
          >
            {COLLECTS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
        <section className="mod" style={{ marginBottom: 20 }}>
          <div className="modhead">
            <h2>What it never collects</h2>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13.5,
              color: "#3d434c",
              lineHeight: 1.7,
            }}
          >
            {NEVER.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mod">
        <div className="modhead">
          <h2>Your controls</h2>
        </div>
        <ul
          style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#3d434c", lineHeight: 1.7 }}
        >
          <li>
            <b>Kill switch:</b> set <span className="mono">FOOTFALL_DISABLED=1</span> to stop all
            emission instantly.
          </li>
          <li>
            <b>Caps:</b> per-site daily caps at the middleware and the ingest endpoint; above the
            cap events are sampled and the dropped count is shown — never silent, never a surprise
            bill.
          </li>
          <li>
            <b>Uninstall:</b> the whole install is one <span className="mono">git diff</span> —
            revert it.
          </li>
        </ul>
      </section>

      <footer>
        Independent open-source project; not affiliated with any hosting provider or agent vendor.
      </footer>
    </main>
  );
}
