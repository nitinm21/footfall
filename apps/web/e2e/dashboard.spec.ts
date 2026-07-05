import { expect, test } from "@playwright/test";
import { expectedDemoKpis, login } from "./helpers";

const DEMO = "demo@footfall.local";
const MODULES = [
  "kpi-agent-requests",
  "kpi-agent-share",
  "kpi-agent-sessions",
  "kpi-failed",
  "mod-traffic",
  "mod-families",
  "mod-receipts",
  "mod-failures",
  "mod-fiximpact",
  "mod-sessions",
];

test.describe("dashboard", () => {
  test("gates the dashboard behind login", async ({ page }) => {
    await page.goto("/sites/demo");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
  });

  test("renders every module for a seeded site", async ({ page }) => {
    await login(page, DEMO);
    await page.goto("/sites/demo");

    await expect(page.getByTestId("site-name")).toContainText("modelkit.dev");
    for (const id of MODULES) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // the traffic chart rendered as an inline SVG
    await expect(page.locator('[data-testid="mod-traffic"] svg')).toBeVisible();
    // the fix-impact story and a receipt's evidence are present
    await expect(page.getByTestId("mod-fiximpact")).toContainText("/llms.txt");
    await expect(page.getByTestId("mod-receipts")).toContainText("asset fetches");
    // the failure feed surfaces the marked /llms.txt fix as live
    await expect(page.getByTestId("mod-failures")).toContainText("fix live");
  });

  test("KPI numbers equal core aggregates (parity)", async ({ page }) => {
    await login(page, DEMO);
    await page.goto("/sites/demo");

    const k = expectedDemoKpis();
    const num = async (id: string) =>
      Number.parseFloat((await page.getByTestId(id).innerText()).replace(/[,%\s]/g, ""));

    expect(await num("kpi-agent-requests")).toBe(k.agentRequests);
    expect(await num("kpi-agent-share")).toBe(k.agentSharePct);
    expect(await num("kpi-agent-sessions")).toBe(k.agentSessions);
    expect(await num("kpi-failed")).toBe(k.failedAgentRequests);
  });

  test("shows empty state for a site with no events", async ({ page }) => {
    await login(page, DEMO);
    await page.goto("/sites/quiet-demo");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("mod-traffic")).toHaveCount(0);
  });

  test("isolation: cannot view another tenant's site (404, no existence leak)", async ({
    page,
  }) => {
    await login(page, DEMO);
    const res = await page.goto("/sites/acme");
    expect(res?.status()).toBe(404);
  });

  test("isolation: API rejects unauthenticated and cross-tenant access", async ({ page }) => {
    const anon = await page.request.get("/api/sites/demo/last-event");
    expect(anon.status()).toBe(401);

    await login(page, DEMO);
    const own = await page.request.get("/api/sites/demo/last-event");
    expect(own.status()).toBe(200);
    const cross = await page.request.get("/api/sites/acme/last-event");
    expect(cross.status()).toBe(404);
  });

  test("onboarding: add a site → personalized install command + listening card", async ({
    page,
  }) => {
    await login(page, DEMO);
    await page.goto("/sites/new");
    await page.locator('input[name="token"]').fill("e2e-onboard.dev");
    await page.getByRole("button", { name: /create site/i }).click();

    await expect(page).toHaveURL(/\/sites\/e2e-onboard\.dev/);
    const card = page.getByTestId("onboard-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("npx footfall init e2e-onboard.dev");
    // scope stated + agent task block with the token baked in
    await expect(card).toContainText(/Next\.js \/ Vercel only/i);
    await expect(card).toContainText(/hand it to your AI agent/i);
    await expect(card).toContainText('vercel env add FOOTFALL_TOKEN');
    await expect(page.getByTestId("listening")).toContainText(/listening for your first event/i);
  });

  test("llms.txt is public and points at the install", async ({ page }) => {
    const res = await page.request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("npx footfall init");
  });
});
