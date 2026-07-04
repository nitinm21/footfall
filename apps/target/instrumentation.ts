import { footfallOnRequestError } from "@footfall/next/beacon";

// Next's server-side error hook — fires for 5xx even when the client is an agent
// (unlike error.tsx, a client component). Emits a 5xx status correction.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
): Promise<void> {
  await footfallOnRequestError(error, request);
}
