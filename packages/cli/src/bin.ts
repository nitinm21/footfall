// footfall — CLI entrypoint. `report` (Phase 3), `init` + `check` (Phase 6).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { analyze, jsonlFieldMap, normalizeJsonl, normalizeVercelDrain } from "@footfall/core";
import { type AccuracySummary, renderReport } from "@footfall/report";
import { runCheck } from "./check";
import { runInit } from "./init";

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
}
function boolFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}
function positional(argv: string[]): string | undefined {
  return argv.find((a) => !a.startsWith("--"));
}

const DEFAULT_API = process.env.FOOTFALL_API ?? "https://footfall.vercel.app";

const USAGE = `footfall — agent-experience analytics

Usage:
  footfall init <token> [--dry-run] [--yes] [--cwd <dir>] [--api <url>]
  footfall check <token> [--url <site-url>] [--api <url>]
  footfall report --format <jsonl|vercel> --in <file> --out <file> [--site-name <name>]

init options:
  --dry-run    print the full plan and write nothing
  --yes        non-interactive (proceed even if the git tree is dirty)
  --cwd        project directory (default: current directory)
  --api        Footfall app base URL (default: $FOOTFALL_API)

report options:
  --format     input format: jsonl (native capture) or vercel (log-drain export)
  --in         input file
  --out        output HTML file
  --site-name  human-readable site name for the report
  --base-url   base URL for generated links (default: https://<site token>)
`;

/** Load the checked-in accuracy baseline for the report footer, if present. */
function loadAccuracy(): AccuracySummary | undefined {
  const path = "fixtures/golden/accuracy-baseline.json";
  if (!existsSync(path)) return undefined;
  try {
    const b = JSON.parse(readFileSync(path, "utf8"));
    return {
      overallAccuracy: b.overallAccuracy ?? 0,
      unclassifiedRate: b.unclassifiedRate ?? 0,
      tier1Precision: b.tier1?.precision ?? 0,
    };
  } catch {
    return undefined;
  }
}

function report(argv: string[]): number {
  const format = flag(argv, "format") ?? "jsonl";
  const input = flag(argv, "in");
  const output = flag(argv, "out");
  const siteName = flag(argv, "site-name");

  if (!input || !output) {
    console.error("report: --in and --out are required\n");
    console.error(USAGE);
    return 1;
  }
  if (!existsSync(input)) {
    console.error(`report: input file not found: ${input}`);
    return 1;
  }

  const text = readFileSync(input, "utf8");
  const site = siteName ?? "site";
  const { events, fieldMap, errors } =
    format === "vercel"
      ? normalizeVercelDrain(text, { site })
      : format === "jsonl"
        ? normalizeJsonl(text)
        : { events: [], fieldMap: jsonlFieldMap, errors: [`unknown format: ${format}`] };

  if (errors.length > 0) {
    console.error(
      `report: ${errors.length} line(s) could not be parsed (continuing with the rest)`,
    );
  }
  if (events.length === 0) {
    console.error("report: no valid events in input");
    return 1;
  }

  const baseUrl = flag(argv, "base-url");
  const result = analyze(events, fieldMap, {
    ...(siteName ? { siteName } : {}),
    // Default baseUrl comes from the event site token (clean); --base-url overrides.
    ...(baseUrl ? { baseUrl } : {}),
  });
  const buildHash = createHash("sha256").update(JSON.stringify(result)).digest("hex").slice(0, 8);
  const accuracy = loadAccuracy();
  const html = renderReport(result, {
    ...(siteName ? { siteName } : {}),
    ...(accuracy ? { accuracy } : {}),
    generatedAt: new Date().toISOString(),
    buildHash,
  });

  writeFileSync(output, html);
  console.log(
    `report: wrote ${output} (${events.length} events, ${result.sessions.length} sessions, source=${fieldMap.source})`,
  );
  return 0;
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case "report":
      return report(rest);
    case "init": {
      const token = positional(rest);
      if (!token) {
        console.error("init: a site token is required\n");
        console.error(USAGE);
        return 1;
      }
      const api = flag(rest, "api") ?? DEFAULT_API;
      return runInit({
        token,
        cwd: flag(rest, "cwd") ?? process.cwd(),
        dryRun: boolFlag(rest, "dry-run"),
        yes: boolFlag(rest, "yes"),
        install: true,
        apiBase: api,
        ingestUrl:
          flag(rest, "ingest-url") ?? process.env.FOOTFALL_INGEST_URL ?? `${api}/api/ingest`,
      });
    }
    case "check": {
      const token = positional(rest);
      if (!token) {
        console.error("check: a site token is required\n");
        console.error(USAGE);
        return 1;
      }
      const api = flag(rest, "api") ?? DEFAULT_API;
      const url = flag(rest, "url");
      return runCheck({ token, apiBase: api, ...(url ? { siteUrl: url } : {}) });
    }
    case undefined:
    case "-h":
    case "--help":
      console.log(USAGE);
      return 0;
    default:
      console.error(`unknown command: ${command}\n`);
      console.error(USAGE);
      return 1;
  }
}

main().then((code) => process.exit(code));
