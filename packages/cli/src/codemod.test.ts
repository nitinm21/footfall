import { describe, expect, it } from "vitest";
import {
  buildInitPlan,
  envOp,
  freshInstrumentation,
  freshMiddleware,
  wrapExistingInstrumentation,
  wrapExistingMiddleware,
} from "./codemod";
import type { ProjectInfo } from "./detect";

const INFO: ProjectInfo = {
  root: "/app",
  isNext: true,
  nextVersion: "15.0.0",
  router: "app",
  srcDir: false,
  typescript: true,
  packageManager: "pnpm",
  ext: "ts",
  middlewarePath: null,
  instrumentationPath: null,
};

describe("middleware codemod", () => {
  it("creates a fresh middleware", () => {
    const s = freshMiddleware();
    expect(s).toContain('import { withFootfall } from "@footfall/next"');
    expect(s).toContain("export default withFootfall();");
    expect(s).toContain("matcher");
  });

  it("wraps a default function export", () => {
    const r = wrapExistingMiddleware("export default function middleware(req) {\n  return;\n}\n");
    expect(r.ok).toBe(true);
    expect(r.contents).toContain('import { withFootfall } from "@footfall/next"');
    expect(r.contents).toContain("function middleware(req)");
    expect(r.contents).toContain("export default withFootfall(middleware);");
    expect(r.contents).not.toMatch(/export\s+default\s+function/);
  });

  it("wraps an anonymous default function", () => {
    const r = wrapExistingMiddleware("export default async function (req) {}\n");
    expect(r.contents).toContain("export default withFootfall(__footfallMiddleware);");
    expect(r.contents).toContain("async function __footfallMiddleware(req)");
  });

  it("wraps an identifier default export", () => {
    const r = wrapExistingMiddleware("function mw(req){}\nexport default mw;\n");
    expect(r.contents).toContain("export default withFootfall(mw);");
  });

  it("wraps a named middleware export", () => {
    const r = wrapExistingMiddleware("export function middleware(req){}\n");
    expect(r.ok).toBe(true);
    expect(r.contents).toContain("function __footfallInner(req)");
    expect(r.contents).toContain("export const middleware = withFootfall(__footfallInner);");
  });

  it("is idempotent when already wrapped", () => {
    const once =
      wrapExistingMiddleware("export default function middleware(req){}\n").contents ?? "";
    const twice = wrapExistingMiddleware(once);
    expect(twice.alreadyWrapped).toBe(true);
    expect(twice.contents).toBe(once);
  });

  it("degrades to manual instructions on an unknown shape", () => {
    const r = wrapExistingMiddleware("const x = 1; // no recognizable export\n");
    expect(r.ok).toBe(false);
    expect(r.manual).toContain("withFootfall");
  });
});

describe("instrumentation codemod (5xx beacon only — no 404 beacon by design)", () => {
  it("creates a fresh instrumentation with onRequestError", () => {
    const s = freshInstrumentation();
    expect(s).toContain("footfallOnRequestError");
    expect(s).toContain("export async function onRequestError");
  });

  it("appends the beacon to instrumentation without onRequestError", () => {
    const r = wrapExistingInstrumentation("export function register(){}\n");
    expect(r.ok).toBe(true);
    expect(r.contents).toContain("register");
    expect(r.contents).toContain("footfallOnRequestError");
  });

  it("degrades to manual when onRequestError already exists", () => {
    const r = wrapExistingInstrumentation("export function onRequestError(){}\n");
    expect(r.ok).toBe(false);
    expect(r.manual).toContain("footfallOnRequestError");
  });
});

describe("env op", () => {
  it("creates .env.local when absent", () => {
    const op = envOp(null, "tok", "https://x/api/ingest");
    expect(op.kind).toBe("create");
    expect(op.contents).toContain("FOOTFALL_TOKEN=tok");
    expect(op.contents).toContain("FOOTFALL_INGEST_URL=https://x/api/ingest");
  });

  it("skips when the token is already present", () => {
    const op = envOp("FOOTFALL_TOKEN=old\nFOOTFALL_INGEST_URL=x\n", "tok", "u");
    expect(op.kind).toBe("skip");
  });
});

describe("full init plan", () => {
  it("plans create+create+create for a clean app-router project", () => {
    const plan = buildInitPlan({
      info: INFO,
      token: "t",
      ingestUrl: "u",
      files: { middleware: null, instrumentation: null, env: null },
    });
    const byPath = Object.fromEntries(plan.ops.map((o) => [o.path, o.kind]));
    expect(byPath["middleware.ts"]).toBe("create");
    expect(byPath["instrumentation.ts"]).toBe("create");
    expect(byPath[".env.local"]).toBe("create");
    expect(plan.installPackage).toBe("@footfall/next");
  });

  it("warns about the matcher when wrapping middleware that has a config", () => {
    const plan = buildInitPlan({
      info: { ...INFO, middlewarePath: "/app/middleware.ts" },
      token: "t",
      ingestUrl: "u",
      files: {
        middleware:
          "export default function middleware(r){}\nexport const config = { matcher: ['/api/:path*'] };\n",
        instrumentation: null,
        env: null,
      },
    });
    expect(plan.warnings.some((w) => w.includes("matcher"))).toBe(true);
  });

  it("flags the pages-router coverage limitation", () => {
    const plan = buildInitPlan({
      info: { ...INFO, router: "pages" },
      token: "t",
      ingestUrl: "u",
      files: { middleware: null, instrumentation: null, env: null },
    });
    expect(plan.warnings.some((w) => w.toLowerCase().includes("pages router"))).toBe(true);
  });
});
