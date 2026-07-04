import type { IngestPayload } from "@footfall/core/ingest";

export type FetchLike = typeof fetch;

/**
 * Fire-and-forget send with a hard timeout and one retry. NEVER throws and never
 * rejects — all failures are swallowed so the site is never affected by ingest health.
 * Returns whether the send eventually succeeded (for tests/metrics only).
 */
export async function sendBatch(
  url: string,
  token: string,
  batch: IngestPayload,
  timeoutMs: number,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const body = JSON.stringify(batch);
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
        keepalive: true,
      });
      clearTimeout(timer);
      if (res.ok) return true;
      // 4xx/5xx: a retry won't help a 4xx, but one cheap retry is fine for 5xx.
    } catch {
      clearTimeout(timer);
      // timeout / network error → swallow, maybe retry
    }
  }
  return false;
}
