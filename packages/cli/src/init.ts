// `footfall init <token>` — verify the token, detect the project, then create/codemod the
// middleware + 5xx beacon and write the env. Contract: no network except token verification,
// never commits or deploys, no telemetry about the user, idempotent, and touch NOTHING before
// the token is confirmed. Side-effecting bits (verify, install) are injectable so it's testable.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildInitPlan, type FileOp } from "./codemod";
import { detectProject, installCommand, type ProjectInfo } from "./detect";

export interface VerifyResult {
  ok: boolean;
  siteName?: string;
}

export interface InitOptions {
  token: string;
  cwd: string;
  dryRun: boolean;
  yes: boolean;
  /** Run the package-manager install (disabled in tests). */
  install: boolean;
  ingestUrl: string;
  apiBase: string;
  /** Injectable token verification (defaults to hitting <apiBase>/api/verify). */
  verify?: (token: string, apiBase: string) => Promise<VerifyResult>;
  /** Injectable installer (defaults to running the detected package manager). */
  runInstall?: (cmd: string, cwd: string) => void;
  log?: (msg: string) => void;
}

async function defaultVerify(token: string, apiBase: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${apiBase}/api/verify?token=${encodeURIComponent(token)}`);
    if (!res.ok) return { ok: false };
    return (await res.json()) as VerifyResult;
  } catch {
    return { ok: false };
  }
}

function defaultRunInstall(cmd: string, cwd: string): void {
  const [bin, ...args] = cmd.split(" ");
  execFileSync(bin as string, args, { cwd, stdio: "inherit" });
}

function gitDirty(cwd: string): boolean {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.toString().trim().length > 0;
  } catch {
    return false; // not a git repo → nothing to protect
  }
}

function ensureGitignored(cwd: string, entry: string): void {
  const path = join(cwd, ".gitignore");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (existing.split("\n").some((l) => l.trim() === entry)) return;
  writeFileSync(path, `${existing.trimEnd()}${existing ? "\n" : ""}${entry}\n`);
}

function readIf(path: string | null): string | null {
  return path && existsSync(path) ? readFileSync(path, "utf8") : null;
}

function summarizeOp(op: FileOp): string {
  const verb = { create: "create", modify: "modify", skip: "skip  ", manual: "MANUAL" }[op.kind];
  return `  ${verb}  ${op.path}  — ${op.reason}`;
}

export async function runInit(opts: InitOptions): Promise<number> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const verify = opts.verify ?? defaultVerify;

  // 1) Verify the token FIRST — abort before touching a single file on any failure.
  const v = await verify(opts.token, opts.apiBase);
  if (!v.ok) {
    log(`✗ Token not recognized by ${opts.apiBase}. Nothing was changed.`);
    return 1;
  }
  log(`✓ Site: ${v.siteName ?? opts.token}`);

  // 2) Detect the project.
  const info: ProjectInfo = detectProject(opts.cwd);
  if (!info.isNext) {
    log("✗ This doesn't look like a Next.js project (no `next` dependency). Nothing was changed.");
    return 1;
  }
  log(
    `• ${info.router === "app" ? "App" : info.router === "pages" ? "Pages" : "Unknown"} Router · ${info.typescript ? "TypeScript" : "JavaScript"}${info.srcDir ? " · src/ layout" : ""} · ${info.packageManager}`,
  );

  // 3) Build the plan from current file contents.
  const plan = buildInitPlan({
    info,
    token: opts.token,
    ingestUrl: opts.ingestUrl,
    files: {
      middleware: readIf(info.middlewarePath),
      instrumentation: readIf(info.instrumentationPath),
      env: readIf(join(opts.cwd, ".env.local")),
    },
  });

  log("\nPlanned changes:");
  for (const op of plan.ops) log(summarizeOp(op));
  log(`  install  ${installCommand(info.packageManager, plan.installPackage)}`);
  for (const w of plan.warnings) log(`  ⚠ ${w}`);

  // 4) Dry run → stop here, write nothing.
  if (opts.dryRun) {
    log("\n--dry-run: no files written.");
    for (const op of plan.ops)
      if (op.kind === "manual") log(`\nManual step for ${op.path}:\n${op.manual}`);
    return 0;
  }

  // 5) A dirty tree makes the whole install reviewable as one `git diff`; pause unless --yes.
  if (!opts.yes && gitDirty(opts.cwd)) {
    log(
      "\n✗ Working tree has uncommitted changes. Commit/stash first so the install is one reviewable diff, or re-run with --yes.",
    );
    return 1;
  }

  // 6) Apply.
  let manualCount = 0;
  for (const op of plan.ops) {
    if (op.kind === "manual") {
      manualCount++;
      log(`\nManual step for ${op.path} (left untouched):\n${op.manual}`);
      continue;
    }
    if (op.kind === "skip" || !op.contents) continue;
    writeFileSync(join(opts.cwd, op.path), op.contents);
    log(`  ${op.kind === "create" ? "created" : "updated"} ${op.path}`);
  }
  ensureGitignored(opts.cwd, ".env.local");

  // 7) Install the dependency with their package manager.
  if (opts.install) {
    const cmd = installCommand(info.packageManager, plan.installPackage);
    log(`\n$ ${cmd}`);
    (opts.runInstall ?? defaultRunInstall)(cmd, opts.cwd);
  }

  // 8) Next steps (the one thing we can't do for them).
  log(`\n✓ Installed. Two things left:`);
  log(
    `  1. Set FOOTFALL_TOKEN=${opts.token} in your host env (e.g. \`vercel env add FOOTFALL_TOKEN\`).`,
  );
  log(`  2. Deploy, then run \`npx footfall check ${opts.token}\` to confirm the round-trip.`);
  if (manualCount > 0)
    log(`  (${manualCount} manual step(s) above — apply them before deploying.)`);
  return 0;
}
