/**
 * Best-effort per-instance daily cap with graceful sampling above it. Edge instances
 * are stateless/distributed, so this is a soft guard; the authoritative cap is enforced
 * at ingest (Phase 6). Crucially, dropped counts are never silent — the next emitted
 * batch carries the accumulated `dropped` so truncation is always visible.
 */
export class Sampler {
  private day = "";
  private count = 0;
  private dropped = 0;

  constructor(
    private readonly cap: number,
    /** Above the cap, keep 1 in `keepEvery`. */
    private readonly keepEvery = 10,
  ) {}

  private roll(nowMs: number): void {
    const d = new Date(nowMs).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.count = 0;
      this.dropped = 0;
    }
  }

  private takeDropped(): number {
    const d = this.dropped;
    this.dropped = 0;
    return d;
  }

  /** Decide whether to emit this request; when emitting, hand back accumulated drops. */
  next(nowMs: number): { emit: boolean; dropped: number } {
    this.roll(nowMs);
    this.count += 1;
    if (this.cap <= 0 || this.count <= this.cap) {
      return { emit: true, dropped: this.takeDropped() };
    }
    const over = this.count - this.cap;
    if (over % this.keepEvery === 0) {
      return { emit: true, dropped: this.takeDropped() };
    }
    this.dropped += 1;
    return { emit: false, dropped: 0 };
  }
}
