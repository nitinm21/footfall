// Pure codemods for `footfall init` — text in, text out, no I/O. Kept pure so the whole
// transformation is golden-testable. The orchestrator (init.ts) does the file I/O.
//
// Design rule from the plan: only transform when we're confident. If an existing middleware
// doesn't match a known-safe shape, we DON'T touch it — we emit `manual` instructions instead.

import type { ProjectInfo } from "./detect";

export interface FileOp {
  /** Path relative to the project root. */
  path: string;
  kind: "create" | "modify" | "skip" | "manual";
  /** New file contents (create/modify). */
  contents?: string;
  /** Why this op exists (shown in the transcript / dry-run diff). */
  reason: string;
  /** For kind === "manual": exact instructions to print; we touch nothing. */
  manual?: string;
}

export interface InitPlan {
  installPackage: string;
  ops: FileOp[];
  warnings: string[];
}

const IMPORT_MW = `import { withFootfall } from "@footfall/next";`;
const IMPORT_BEACON = `import { footfallOnRequestError } from "@footfall/next/beacon";`;

function mwRelPath(info: ProjectInfo): string {
  return info.srcDir ? `src/middleware.${info.ext}` : `middleware.${info.ext}`;
}
function instrRelPath(info: ProjectInfo): string {
  return info.srcDir ? `src/instrumentation.${info.ext}` : `instrumentation.${info.ext}`;
}

// ── middleware ────────────────────────────────────────────────────────────────

/** A fresh middleware file for a project with none. */
export function freshMiddleware(): string {
  return `${IMPORT_MW}

// Observe-only Footfall capture — never blocks, modifies, or delays a response, and is inert
// unless FOOTFALL_TOKEN + FOOTFALL_INGEST_URL are set.
export default withFootfall();

export const config = {
  // Capture pages AND static assets (asset ratio is a top classifier signal); skip Next internals.
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
`;
}

function addImport(src: string): string {
  if (src.includes("@footfall/next")) return src;
  // Insert after the last top-level import line, else at the very top.
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s.+from\s.+/.test(lines[i] ?? "")) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, IMPORT_MW);
    return lines.join("\n");
  }
  return `${IMPORT_MW}\n${src}`;
}

export interface WrapResult {
  ok: boolean;
  contents?: string;
  /** True when the file already uses withFootfall (idempotent no-op). */
  alreadyWrapped?: boolean;
  /** Manual instructions when we can't confidently transform. */
  manual?: string;
}

/**
 * Wrap an existing middleware file's export with withFootfall(). Handles the confident,
 * common shapes; anything else returns { ok:false, manual } and the file is left untouched.
 */
export function wrapExistingMiddleware(src: string): WrapResult {
  if (src.includes("withFootfall")) return { ok: true, alreadyWrapped: true, contents: src };

  const withImport = addImport(src);

  // 1) `export default function NAME(...)` / async
  const namedDefault = withImport.match(
    /export\s+default\s+(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/,
  );
  if (namedDefault) {
    const name = namedDefault[2];
    const body = withImport.replace(
      /export\s+default\s+(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/,
      "$1function $2(",
    );
    return { ok: true, contents: `${body.trimEnd()}\n\nexport default withFootfall(${name});\n` };
  }

  // 2) anonymous `export default function(...)` / async
  const anonDefault = withImport.match(/export\s+default\s+(async\s+)?function\s*\(/);
  if (anonDefault) {
    const body = withImport.replace(
      /export\s+default\s+(async\s+)?function\s*\(/,
      "$1function __footfallMiddleware(",
    );
    return {
      ok: true,
      contents: `${body.trimEnd()}\n\nexport default withFootfall(__footfallMiddleware);\n`,
    };
  }

  // 3) `export default IDENT;`
  const identDefault = withImport.match(/export\s+default\s+([A-Za-z0-9_$]+)\s*;/);
  if (identDefault) {
    const contents = withImport.replace(
      /export\s+default\s+([A-Za-z0-9_$]+)\s*;/,
      "export default withFootfall($1);",
    );
    return { ok: true, contents };
  }

  // 4) named `export function middleware(...)` / async  →  rename + re-export wrapped
  const namedMw = withImport.match(/export\s+(async\s+)?function\s+middleware\s*\(/);
  if (namedMw) {
    const contents = `${withImport
      .replace(/export\s+(async\s+)?function\s+middleware\s*\(/, "$1function __footfallInner(")
      .trimEnd()}\n\nexport const middleware = withFootfall(__footfallInner);\n`;
    return { ok: true, contents };
  }

  // Unknown shape — do not guess.
  return {
    ok: false,
    manual: `Could not confidently wrap your middleware. Add Footfall manually:

  1. ${IMPORT_MW}
  2. Wrap your exported middleware function:  export default withFootfall(yourMiddleware)
     (keep your existing \`export const config = { matcher }\`)`,
  };
}

// ── instrumentation (5xx beacon) ───────────────────────────────────────────────
// NOTE: there is deliberately NO not-found.tsx (404) beacon. Next renders the not-found
// boundary body on every request in a segment, so a beacon there marks 200s as 404. 404 status
// is resolved by the outside-in probe + Vercel drain instead (see @footfall/next beacon.ts).

export function freshInstrumentation(): string {
  return `${IMPORT_BEACON}

// Next's server-side error hook — fires for 5xx even when the client is an agent (unlike
// error.tsx, a client component). Emits a status correction the ingest pipeline correlates by id.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
): Promise<void> {
  await footfallOnRequestError(error, request);
}
`;
}

/** Add the Footfall 5xx beacon to an existing instrumentation file, or emit manual instructions. */
export function wrapExistingInstrumentation(src: string): WrapResult {
  if (src.includes("footfallOnRequestError"))
    return { ok: true, alreadyWrapped: true, contents: src };
  // Only safe-transform when there's no existing onRequestError to conflict with.
  if (
    /export\s+(async\s+)?function\s+onRequestError/.test(src) ||
    /onRequestError\s*[:=]/.test(src)
  ) {
    return {
      ok: false,
      manual: `Your instrumentation file already defines onRequestError. Add one line inside it:

  ${IMPORT_BEACON}
  // inside onRequestError(error, request):
  await footfallOnRequestError(error, request);`,
    };
  }
  return { ok: true, contents: `${src.trimEnd()}\n\n${freshInstrumentation()}` };
}

// ── env ────────────────────────────────────────────────────────────────────────

export function envOp(existing: string | null, token: string, ingestUrl: string): FileOp {
  const path = ".env.local";
  const needsToken = !existing || !/^\s*FOOTFALL_TOKEN=/m.test(existing);
  const needsUrl = !existing || !/^\s*FOOTFALL_INGEST_URL=/m.test(existing);
  if (!needsToken && !needsUrl) {
    return { path, kind: "skip", reason: "FOOTFALL_TOKEN already present in .env.local" };
  }
  const additions: string[] = [];
  if (needsToken) additions.push(`FOOTFALL_TOKEN=${token}`);
  if (needsUrl) additions.push(`FOOTFALL_INGEST_URL=${ingestUrl}`);
  const block = `# Footfall — agent-experience analytics (observe-only)\n${additions.join("\n")}\n`;
  const contents = existing ? `${existing.trimEnd()}\n\n${block}` : block;
  return {
    path,
    kind: existing ? "modify" : "create",
    contents,
    reason: "write FOOTFALL_TOKEN / FOOTFALL_INGEST_URL",
  };
}

// ── the full plan ────────────────────────────────────────────────────────────

export interface BuildPlanInput {
  info: ProjectInfo;
  token: string;
  ingestUrl: string;
  /** Current file contents keyed by relative path (null when absent). */
  files: {
    middleware: string | null;
    instrumentation: string | null;
    env: string | null;
  };
}

export function buildInitPlan(input: BuildPlanInput): InitPlan {
  const { info, token, ingestUrl, files } = input;
  const ops: FileOp[] = [];
  const warnings: string[] = [];

  // middleware
  const mwPath = info.middlewarePath
    ? info.middlewarePath.replace(`${info.root}/`, "")
    : mwRelPath(info);
  if (files.middleware === null) {
    ops.push({
      path: mwPath,
      kind: "create",
      contents: freshMiddleware(),
      reason: "create middleware.ts with observe-only capture",
    });
  } else {
    const w = wrapExistingMiddleware(files.middleware);
    if (w.alreadyWrapped) {
      ops.push({ path: mwPath, kind: "skip", reason: "middleware already wraps withFootfall" });
    } else if (w.ok && w.contents) {
      ops.push({
        path: mwPath,
        kind: "modify",
        contents: w.contents,
        reason: "wrap existing middleware with withFootfall()",
      });
      if (/export\s+const\s+config\s*=/.test(files.middleware)) {
        warnings.push(
          "Kept your existing middleware `matcher` — Footfall captures only the routes it already runs on. Broaden the matcher yourself to capture all traffic.",
        );
      }
    } else {
      ops.push({
        path: mwPath,
        kind: "manual",
        reason: "middleware shape not recognized",
        manual: w.manual ?? "Wrap your exported middleware with withFootfall().",
      });
    }
  }

  // instrumentation (5xx beacon)
  const instrPath = info.instrumentationPath
    ? info.instrumentationPath.replace(`${info.root}/`, "")
    : instrRelPath(info);
  if (files.instrumentation === null) {
    ops.push({
      path: instrPath,
      kind: "create",
      contents: freshInstrumentation(),
      reason: "create instrumentation.ts with the 5xx beacon",
    });
  } else {
    const w = wrapExistingInstrumentation(files.instrumentation);
    if (w.alreadyWrapped) {
      ops.push({
        path: instrPath,
        kind: "skip",
        reason: "instrumentation already has the Footfall beacon",
      });
    } else if (w.ok && w.contents) {
      ops.push({
        path: instrPath,
        kind: "modify",
        contents: w.contents,
        reason: "add the Footfall 5xx beacon",
      });
    } else {
      ops.push({
        path: instrPath,
        kind: "manual",
        reason: "instrumentation has its own onRequestError",
        manual: w.manual ?? "Call footfallOnRequestError(error, request) inside onRequestError.",
      });
    }
  }

  // env
  ops.push(envOp(files.env, token, ingestUrl));

  if (info.router === "pages") {
    warnings.push(
      "Pages Router detected: middleware-only install. Response statuses stay null (handled by the coverage matrix) since there's no app-router instrumentation hook.",
    );
  }

  return { installPackage: "@footfall/next", ops, warnings };
}
