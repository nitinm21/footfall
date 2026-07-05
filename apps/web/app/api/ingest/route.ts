import { handleIngest, sinkFromEnv } from "../../../src/ingest";
import { recordUsage } from "../../../src/usage";

// Node runtime for local dev (file sink). On Vercel this also runs as a function;
// switching to the edge runtime later only requires an fetch-based sink (Tinybird).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    raw = null;
  }

  const result = await handleIngest(raw, token, sinkFromEnv(), { recordUsage });
  return new Response(result.body, { status: result.status });
}
