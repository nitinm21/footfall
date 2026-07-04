import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALL_FIELDS,
  analyze,
  type Event,
  type FieldMap,
  jsonlFieldMap,
  normalizeJsonl,
} from "@footfall/core";
import { describe, expect, it } from "vitest";
import { renderReport } from "./report";

const TRACES = fileURLToPath(new URL("../../../fixtures/traces/", import.meta.url));

function loadCorpus(): Event[] {
  const events: Event[] = [];
  for (const label of readdirSync(TRACES).sort()) {
    const dir = `${TRACES}${label}`;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files.sort())
      events.push(...normalizeJsonl(readFileSync(`${dir}/${file}`, "utf8")).events);
  }
  return events;
}

const ACCURACY = { overallAccuracy: 0.923, tier1Precision: 1, unclassifiedRate: 0 };

function render(fieldMap: FieldMap): string {
  // No generatedAt/buildHash → byte-stable output for the golden.
  return renderReport(analyze(loadCorpus(), fieldMap), {
    siteName: "target-local (Acme SDK)",
    accuracy: ACCURACY,
  });
}

describe("renderReport", () => {
  it("produces byte-stable HTML for the corpus (golden)", () => {
    expect(render(jsonlFieldMap)).toMatchSnapshot();
  });

  it("is a self-contained, script-free HTML document", () => {
    const html = render(jsonlFieldMap);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toContain("<script");
    expect(html).toContain("<style>");
    expect(html).toContain("aria-label"); // charts are accessible SVG
  });

  it("prints the classifier accuracy in the footer (honesty is a feature)", () => {
    expect(render(jsonlFieldMap)).toContain("Classifier accuracy");
  });

  it("greys out the empty-shell module when response bytes are missing", () => {
    const lowFi: FieldMap = {
      source: "drain-lite",
      realtime: false,
      fields: ALL_FIELDS.filter((f) => f !== "resp_bytes"),
    };
    const html = render(lowFi);
    expect(html).toContain("failcard h greyed");
    expect(html).toContain("Needs the response-bytes signal");
    // everything else still renders
    expect(html).toContain("Top pages by agent demand");
  });

  it("does not grey out empty-shell for full-fidelity sources", () => {
    expect(render(jsonlFieldMap)).not.toContain("failcard h greyed");
  });
});
