import { auth } from "../../../../../auth";
import { getAccessibleSite } from "../../../../../lib/access";
import { latestEventTs } from "../../../../../src/events-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by the live indicator. Auth + membership enforced (never leak another tenant's data). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });

  const { token } = await params;
  const site = await getAccessibleSite(session.user.id, token);
  if (!site) return new Response("not found", { status: 404 });

  const now = Date.now();
  const ts = await latestEventTs(site, now);
  return Response.json({ lastEventTs: ts, now, source: site.source });
}
