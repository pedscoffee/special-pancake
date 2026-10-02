import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("pages and the medicine dialog meet automated WCAG AA checks", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/medicines/",
    "/symptoms/",
    "/history/",
    "/reports/",
    "/settings/",
  ]) {
    await page.goto(route);
    await expect(page.locator(".loading-state")).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      route,
    ).toEqual([]);
  }
  await page.goto("/");
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("capture the redesigned dashboard", async ({ page }, info) => {
  await page.goto("/settings/");
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "Ella’s care, in good hands." }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/previews/${info.project.name}.png`,
    fullPage: true,
  });
});
