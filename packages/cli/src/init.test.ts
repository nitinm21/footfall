import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type InitOptions, runInit } from "./init";

let dir = "";

function scaffold(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), "ff-init-"));
  for (const [p, c] of Object.entries(files)) {
    const full = join(dir, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, c);
  }
  return dir;
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

const okVerify = async () => ({ ok: true, siteName: "Test Site" });

function opts(over: Partial<InitOptions> = {}): InitOptions {
  return {
    token: "t",
    cwd: dir,
    dryRun: false,
    yes: true,
    install: false,
    ingestUrl: "https://x/api/ingest",
    apiBase: "https://x",
    verify: okVerify,
    log: () => {},
    ...over,
  };
}

const NEXT_PKG = JSON.stringify({ dependencies: { next: "15.0.0" } });

describe("footfall init", () => {
  it("wires a clean app-router project", async () => {
    scaffold({
      "package.json": NEXT_PKG,
      "tsconfig.json": "{}",
      "app/page.tsx": "export default () => null;\n",
    });
    const code = await runInit(opts());
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "middleware.ts"), "utf8")).toContain("withFootfall()");
    expect(readFileSync(join(dir, "instrumentation.ts"), "utf8")).toContain(
      "footfallOnRequestError",
    );
    expect(readFileSync(join(dir, ".env.local"), "utf8")).toContain("FOOTFALL_TOKEN=t");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".env.local");
  });

  it("uses the src/ layout when present", async () => {
    scaffold({
      "package.json": NEXT_PKG,
      "tsconfig.json": "{}",
      "src/app/page.tsx": "export default () => null;\n",
    });
    await runInit(opts());
    expect(existsSync(join(dir, "src/middleware.ts"))).toBe(true);
    expect(existsSync(join(dir, "src/instrumentation.ts"))).toBe(true);
  });

  it("wraps an existing middleware instead of overwriting it", async () => {
    scaffold({
      "package.json": NEXT_PKG,
      "tsconfig.json": "{}",
      "app/page.tsx": "export default () => null;\n",
      "middleware.ts": "export default function middleware(req) {\n  return;\n}\n",
    });
    await runInit(opts());
    const mw = readFileSync(join(dir, "middleware.ts"), "utf8");
    expect(mw).toContain("export default withFootfall(middleware);");
    expect(mw).toContain("function middleware(req)");
  });

  it("is idempotent (second run makes no further change)", async () => {
    scaffold({ "package.json": NEXT_PKG, "tsconfig.json": "{}", "app/page.tsx": "x" });
    await runInit(opts());
    const first = readFileSync(join(dir, "middleware.ts"), "utf8");
    await runInit(opts());
    expect(readFileSync(join(dir, "middleware.ts"), "utf8")).toBe(first);
  });

  it("--dry-run writes nothing", async () => {
    scaffold({ "package.json": NEXT_PKG, "tsconfig.json": "{}", "app/page.tsx": "x" });
    const code = await runInit(opts({ dryRun: true }));
    expect(code).toBe(0);
    expect(existsSync(join(dir, "middleware.ts"))).toBe(false);
    expect(existsSync(join(dir, ".env.local"))).toBe(false);
  });

  it("aborts before touching any file when the token is invalid", async () => {
    scaffold({ "package.json": NEXT_PKG, "tsconfig.json": "{}", "app/page.tsx": "x" });
    const code = await runInit(opts({ verify: async () => ({ ok: false }) }));
    expect(code).toBe(1);
    expect(existsSync(join(dir, "middleware.ts"))).toBe(false);
  });

  it("refuses a non-Next project", async () => {
    scaffold({ "package.json": JSON.stringify({ dependencies: {} }) });
    const code = await runInit(opts());
    expect(code).toBe(1);
    expect(existsSync(join(dir, "middleware.ts"))).toBe(false);
  });

  it("leaves an unrecognized middleware untouched and prints manual steps", async () => {
    const original = "const notMiddleware = 1;\n";
    scaffold({
      "package.json": NEXT_PKG,
      "tsconfig.json": "{}",
      "app/page.tsx": "x",
      "middleware.ts": original,
    });
    const msgs: string[] = [];
    const code = await runInit(opts({ log: (m) => msgs.push(m) }));
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "middleware.ts"), "utf8")).toBe(original);
    expect(msgs.join("\n")).toContain("Manual step");
  });

  it("flags pages-router coverage in the transcript", async () => {
    scaffold({
      "package.json": NEXT_PKG,
      "tsconfig.json": "{}",
      "pages/index.tsx": "export default () => null;\n",
    });
    const msgs: string[] = [];
    await runInit(opts({ log: (m) => msgs.push(m) }));
    expect(msgs.join("\n").toLowerCase()).toContain("pages router");
  });
});
