// Ingest-side per-site daily cap. Pure decision function (unit-tested); the atomic day counter
// lives in the route (Postgres). A soft cap: above it we sample by dropping the batch's tail and
// counting the drops — never a silent truncation, and never a surprise Tinybird bill.

export interface CapDecision {
  accept: number;
  drop: number;
}

/** Given today's count so far, how many of this batch to accept vs drop. cap<=0 = uncapped. */
export function applyCap(receivedBefore: number, batchCount: number, cap: number): CapDecision {
  if (cap <= 0) return { accept: batchCount, drop: 0 };
  const room = Math.max(0, cap - Math.max(0, receivedBefore));
  const accept = Math.min(batchCount, room);
  return { accept, drop: batchCount - accept };
}
