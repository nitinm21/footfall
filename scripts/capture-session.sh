#!/usr/bin/env bash
#
# capture-session.sh — record one labelled session (Phase 1 helper).
#
# Starts the capture proxy (:4000 -> :3000), runs the client command you pass,
# then stops the proxy and prints how many events it recorded. The target rig
# must already be running (see fixtures/README.md).
#
# Usage:
#   scripts/capture-session.sh <out.jsonl> <client command...>
#
# Examples:
#   scripts/capture-session.sh fixtures/traces/crawler/run-04.jsonl \
#     ./node_modules/.bin/tsx scripts/crawl.ts http://localhost:4000
#   scripts/capture-session.sh fixtures/traces/human-browser/run-04.jsonl \
#     ./node_modules/.bin/tsx scripts/browse.ts http://localhost:4000
#   scripts/capture-session.sh fixtures/traces/claude-code/run-04.jsonl \
#     claude -p "Read the docs at http://localhost:4000 ..." --dangerously-skip-permissions --allowedTools Bash

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <out.jsonl> <client command...>" >&2
  exit 1
fi

OUT="$1"; shift
PORT="${FOOTFALL_CAPTURE_PORT:-4000}"
TARGET="${FOOTFALL_CAPTURE_TARGET:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$(mktemp)"

rm -f "$OUT"
"$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/capture.ts" \
  --out "$OUT" --port "$PORT" --target "$TARGET" > "$LOG" 2>&1 &
PID=$!

# Wait for the proxy to be listening (no request sent, so no stray event).
until grep -q "proxying" "$LOG" 2>/dev/null; do :; done

# Run the client (its requests are the only ones recorded).
"$@" || true

kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
grep "recorded" "$LOG" || true
