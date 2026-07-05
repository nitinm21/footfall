// Pure project detection for `footfall init`: what kind of Next.js app is this, and how is it
// laid out? Drives the codemod (where middleware/instrumentation live) and the install command.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
export type Router = "app" | "pages" | "unknown";

export interface ProjectInfo {
  root: string;
  isNext: boolean;
  nextVersion: string | null;
  router: Router;
  /** Uses the `src/` layout. */
  srcDir: boolean;
  typescript: boolean;
  packageManager: PackageManager;
  ext: "ts" | "js";
  /** Existing middleware file (absolute), if any. */
  middlewarePath: string | null;
  /** Existing instrumentation file (absolute), if any. */
  instrumentationPath: string | null;
}

/** Package manager from the lockfile — use theirs, don't impose ours. Walks up so the lockfile
 * is found even in a monorepo where it lives at the repo root, not the app directory. */
export function detectPackageManager(root: string): PackageManager {
  let dir = root;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
    if (existsSync(join(dir, "yarn.lock"))) return "yarn";
    if (existsSync(join(dir, "package-lock.json"))) return "npm";
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return "npm";
}

function firstExisting(root: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const p = join(root, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export function detectProject(root: string): ProjectInfo {
  let isNext = false;
  let nextVersion: string | null = null;
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) {
        isNext = true;
        nextVersion = String(deps.next);
      }
    } catch {
      /* unreadable package.json → treat as non-Next */
    }
  }

  const srcDir =
    existsSync(join(root, "src", "app")) ||
    existsSync(join(root, "src", "pages")) ||
    existsSync(join(root, "src", "middleware.ts")) ||
    existsSync(join(root, "src", "middleware.js"));
  const base = srcDir ? join(root, "src") : root;

  let router: Router = "unknown";
  if (existsSync(join(base, "app"))) router = "app";
  else if (existsSync(join(base, "pages"))) router = "pages";

  const typescript = existsSync(join(root, "tsconfig.json"));
  const ext: "ts" | "js" = typescript ? "ts" : "js";

  const middlewarePath = firstExisting(root, [
    "middleware.ts",
    "middleware.js",
    "src/middleware.ts",
    "src/middleware.js",
  ]);
  const instrumentationPath = firstExisting(root, [
    "instrumentation.ts",
    "instrumentation.js",
    "src/instrumentation.ts",
    "src/instrumentation.js",
  ]);

  return {
    root,
    isNext,
    nextVersion,
    router,
    srcDir,
    typescript,
    packageManager: detectPackageManager(root),
    ext,
    middlewarePath,
    instrumentationPath,
  };
}

/** Install command for a package manager (dev/prod dep add). */
export function installCommand(pm: PackageManager, pkg: string): string {
  switch (pm) {
    case "pnpm":
      return `pnpm add ${pkg}`;
    case "yarn":
      return `yarn add ${pkg}`;
    case "bun":
      return `bun add ${pkg}`;
    default:
      return `npm install ${pkg}`;
  }
}
