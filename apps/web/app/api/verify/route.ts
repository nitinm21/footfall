import { db, eq } from "../../../db";
import { sites } from "../../../db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token verification for `footfall init`/`check` and the onboarding "first event" flow.
 * Public by design: the token *is* the credential. Returns the site name on a valid token so
 * the CLI can echo "Site: <name>" before touching a single file, and 404s otherwise.
 */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 400 });

  const [site] = await db.select().from(sites).where(eq(sites.token, token)).limit(1);
  if (!site) return Response.json({ ok: false }, { status: 404 });

  return Response.json({ ok: true, siteName: site.name });
}
