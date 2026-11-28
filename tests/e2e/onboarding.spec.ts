import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { chooseChild, addChildFromMenu } from "./helpers";

test.describe("first run", () => {
  // Start without the stored agreement that the other tests use.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the agreement comes before any page, the demo included, and is remembered", async ({
    page,
  }) => {
    for (const route of ["/", "/settings/", "/reports/"]) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Before you start" }),
      ).toBeVisible();
      await expect(page.getByRole("navigation")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Explore the demo" }),
      ).toHaveCount(0);
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(".form-error")).toHaveText(
      "Please check both boxes to continue.",
    );
    await page.getByLabel(/only under the care of/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(".form-error")).toBeVisible();
    await page.getByLabel(/in development and not yet ready/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kiddymeds-attestation")!),
    );
    expect(saved.version).toBe("2026-11-27");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Before you start" }),
    ).toHaveCount(0);

    // A changed agreement asks again.
    await page.evaluate(() =>
      localStorage.setItem(
        "kiddymeds-attestation",
        JSON.stringify({ version: "older" }),
      ),
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Before you start" }),
    ).toBeVisible();
  });
});

test("the header picks the child on any page", async ({ page }) => {
  await page.goto("/");
  await addChildFromMenu(page, "Oliver");
  await page.goto("/history/");
  await chooseChild(page, "Your child");
  await page.goto("/symptoms/");
  await chooseChild(page, "Oliver");
  await page.getByRole("button", { name: /^Switch child/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#child-menu-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Switch child/ }),
  ).toBeFocused();
});

test("one-tap 'not seen' checks save, show in the report, and undo with a second tap", async ({
  page,
}) => {
  await page.goto("/symptoms/");
  const chip = page.getByRole("button", { name: /^No rash/ });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^No vomiting/ }).click();
  await page.goto("/reports/");
  const summary = page.locator(".visit-summary");
  await expect(summary).toContainText("Rash");
  await expect(summary).toContainText("Checked today");
  await expect(summary).not.toContainText("Fever");
  await page.goto("/symptoms/");
  await page.getByRole("button", { name: /^No rash/ }).click();
  await expect(page.getByRole("button", { name: /^No rash/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const values = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.map(
      (l: { data: { value: string } }) => l.data.value,
    ),
  );
  expect(values).toEqual(["Vomiting"]);
});

test("History shares and exports what its filters show", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await page.getByLabel("Medicine name").fill("Tylenol");
  await page.getByRole("button", { name: "Save entry" }).click();
  await page
    .getByRole("button", { name: "Daily check-in", exact: true })
    .click();
  await page
    .getByLabel("Drinking compared with usual")
    .selectOption("Usual amount");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.goto("/history/");
  const share = page.getByRole("region", { name: "Share or export" });
  await expect(share).toContainText("2 entries");
  await page
    .getByRole("group", { name: "Filter by record type" })
    .getByRole("button", { name: "Medicines", exact: true })
    .click();
  await expect(share).toContainText("1 entry");
  await expect(page.locator(".history-print .report-text")).toContainText(
    "Tylenol",
  );
  await expect(page.locator(".history-print .report-text")).not.toContainText(
    "Fluids",
  );
  // Hand off and Receive stay up front; the rest sit under Export.
  await expect(
    share.getByRole("button", { name: "Share care file" }),
  ).toHaveCount(0);
  await share.getByRole("button", { name: "Export…" }).click();
  await expect(
    share.getByRole("button", { name: "Share care file" }),
  ).toBeEnabled();
  await expect(
    share.getByRole("button", { name: "Receive care" }),
  ).toBeVisible();
});
