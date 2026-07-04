import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const fileUrl = (name: string) => `file://${join(here, ".generated", name)}`;

test("report renders with zero console errors, charts, and honesty flags", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(fileUrl("report.html"));

  expect(errors, "no console/page errors").toEqual([]);

  // Charts present with accessible labels (donut, daily line, families, 404s).
  await expect(page.locator("svg[aria-label]")).toHaveCount(4);

  // Axes labeled.
  await expect(page.getByText("Requests per day")).toBeVisible();
  await expect(page.getByText("Agent requests answered 404/410")).toBeVisible();

  // Heuristic flag visible, and the accuracy footer (honesty is a feature).
  await expect(page.getByText("HEURISTIC").first()).toBeVisible();
  await expect(page.getByText(/Classifier accuracy/)).toBeVisible();

  // All modules present.
  for (const h of [
    "Who is visiting",
    "Agent families",
    "Top pages by agent demand",
    "Recommended fixes",
  ]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
});

test("low-fidelity source greys out empty-shell but renders everything else", async ({ page }) => {
  await page.goto(fileUrl("report-lowfi.html"));

  const greyed = page.locator(".failcard.greyed");
  await expect(greyed).toBeVisible();
  await expect(page.getByText(/Needs the response-bytes signal/)).toBeVisible();

  // The coverage matrix marks response bytes missing…
  await expect(page.getByText("missing").first()).toBeVisible();
  // …but the rest of the report still renders.
  await expect(page.locator("svg[aria-label]").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top pages by agent demand" })).toBeVisible();
});
