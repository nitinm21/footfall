import { db, eq } from "../../../../db";
import { sites } from "../../../../db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How many events a site has received since a timestamp — used by `footfall check` to confirm its
 * own probe traffic round-tripped. Token-authorized (the token is the site credential); the
 * Tinybird token stays server-side.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const since = Number(url.searchParams.get("since") ?? "0");
  if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 400 });

  const [site] = await db.select().from(sites).where(eq(sites.token, token)).limit(1);
  if (!site) return Response.json({ ok: false }, { status: 404 });

  const tbToken = process.env.TINYBIRD_TOKEN;
  if (!tbToken) return Response.json({ ok: true, count: 0, note: "no event store configured" });
  const host = process.env.TINYBIRD_HOST ?? "https://api.tinybird.co";

  const qs = new URLSearchParams({
    site: token,
    since: String(since),
    until: String(Date.now() + 60_000),
    row_limit: "1000",
  });
  try {
    const res = await fetch(`${host}/v0/pipes/events_by_site.json?${qs}`, {
      headers: { authorization: `Bearer ${tbToken}` },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ ok: false, error: `store ${res.status}` }, { status: 502 });
    const json = (await res.json()) as { data?: unknown[] };
    return Response.json({ ok: true, count: json.data?.length ?? 0 });
  } catch {
    return Response.json({ ok: false, error: "store unreachable" }, { status: 502 });
  }
}
