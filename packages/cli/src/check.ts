// `footfall check <token>` — post-deploy verification that closes the loop by *being* the traffic:
// fetch the live site, then confirm the event round-tripped through the API (with timing). Also
// fetches a nonexistent path so a 404 request is captured (its status is resolved asynchronously by
// the outside-in probe / drain — there is no real-time 404 beacon, by design).

export interface CheckOptions {
  token: string;
  apiBase: string;
  /** Live site URL; defaults to https://<token> when the token is a hostname. */
  siteUrl?: string;
  dashboardBase?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  log?: (msg: string) => void;
}

const UA = "footfall-check/1.0";

function defaultSiteUrl(token: string): string | null {
  if (/^https?:\/\//.test(token)) return token;
  if (/\.[a-z]{2,}$/i.test(token)) return `https://${token}`;
  return null;
}

export async function runCheck(opts: CheckOptions): Promise<number> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? 30_000;

  // 1) Verify the token.
  let siteName = opts.token;
  try {
    const v = await fetchImpl(`${opts.apiBase}/api/verify?token=${encodeURIComponent(opts.token)}`);
    if (!v.ok) {
      log(`✗ Token not recognized by ${opts.apiBase}.`);
      return 1;
    }
    siteName = ((await v.json()) as { siteName?: string }).siteName ?? opts.token;
  } catch {
    log(`✗ Could not reach ${opts.apiBase}.`);
    return 1;
  }

  const siteUrl = opts.siteUrl ?? defaultSiteUrl(opts.token);
  if (!siteUrl) {
    log("✗ Could not derive the site URL from the token — pass --url https://your-site.com");
    return 1;
  }
  log(`✓ Site: ${siteName} → ${siteUrl}`);

  // 2) Be the traffic: one real page + one deliberate 404.
  const t0 = now();
  const probe = async (path: string) => {
    try {
      await fetchImpl(`${siteUrl}${path}`, { headers: { "user-agent": UA }, redirect: "manual" });
    } catch {
      /* the fetch itself failing is fine; we only care whether the event arrives */
    }
  };
  await probe("/");
  await probe(`/__footfall_check_${t0}`); // nonexistent → a 404 request event

  // 3) Poll for the event to round-trip through ingest → store.
  log("• sent probe traffic; waiting for the event to arrive…");
  let elapsed = 0;
  while (elapsed < timeoutMs) {
    await sleep(2000);
    elapsed = now() - t0;
    try {
      const r = await fetchImpl(
        `${opts.apiBase}/api/events/recent?token=${encodeURIComponent(opts.token)}&since=${t0}`,
      );
      if (r.ok) {
        const { count } = (await r.json()) as { count?: number };
        if ((count ?? 0) > 0) {
          const dash = `${opts.dashboardBase ?? opts.apiBase}/sites/${encodeURIComponent(opts.token)}`;
          log(`✓ Round-trip confirmed in ${(elapsed / 1000).toFixed(1)}s (${count} event(s)).`);
          log(
            "  Note: 404 status is resolved asynchronously by the outside-in probe, not in real time.",
          );
          log(`→ Dashboard: ${dash}`);
          return 0;
        }
      }
    } catch {
      /* keep polling */
    }
  }

  log(
    `✗ No event seen in ${timeoutMs / 1000}s. Check that FOOTFALL_TOKEN + FOOTFALL_INGEST_URL are set on the host and the site is deployed.`,
  );
  return 1;
}
