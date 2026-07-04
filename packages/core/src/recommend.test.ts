import { describe, expect, it } from "vitest";
import { classifyAll } from "./classify";
import { detect } from "./detect";
import { generateLlmsTxt, recommend } from "./recommend";
import { sessionize } from "./sessionize";
import { BASE_TS, makeEvent } from "./testkit";
import type { TopPageRow } from "./types";

const UA = "curl/8.1.1";

describe("recommend", () => {
  const sessions = classifyAll(
    sessionize([
      makeEvent({ ua: UA, path: "/", ts: BASE_TS }),
      makeEvent({ ua: UA, path: "/llms.txt", status: 404, ts: BASE_TS + 1000 }),
      makeEvent({ ua: UA, path: "/llms.txt", status: 404, ts: BASE_TS + 2000 }),
      makeEvent({ ua: UA, path: "/docs/api/chat.md", status: 404, ts: BASE_TS + 3000 }),
    ]),
  );
  const topPages: TopPageRow[] = [
    { path: "/docs/api", agentRequests: 10, humanRequests: 2, agentSharePct: 83.3 },
  ];

  it("ranks fixes by the demand that justifies them", () => {
    const { recommendations } = recommend(detect(sessions), topPages, {
      siteName: "modelkit.dev",
      baseUrl: "https://modelkit.dev",
    });
    const llms = recommendations.find((r) => r.title.includes("/llms.txt"));
    expect(llms?.metric).toBe(2);
    // llms (2) should rank above the single markdown-mirror dead-end (1)
    expect(recommendations[0]?.title).toContain("/llms.txt");
    expect(recommendations.some((r) => r.title.includes("markdown mirrors"))).toBe(true);
  });

  it("generates an llms.txt draft from top agent pages", () => {
    const txt = generateLlmsTxt(topPages, {
      siteName: "modelkit.dev",
      baseUrl: "https://modelkit.dev/",
    });
    expect(txt).toContain("# modelkit.dev");
    expect(txt).toContain("[Api](https://modelkit.dev/docs/api)");
  });
});
