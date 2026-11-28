import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openChildMenu } from "./helpers";

async function makeLink(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", { value: undefined }),
  );
  await page.goto("/");
  // A short illness: got sick, a fever, a medicine that helped, with notes.
  await page.getByRole("button", { name: "Got sick", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await page
    .getByRole("button", { name: "Log a symptom", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Symptom", { exact: true }).fill("Fever");
  await dialog.getByRole("spinbutton", { name: /^Temperature/ }).fill("101.6");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Medicine name").fill("Motrin");
  await dialog.getByLabel("Interval in hours optional").fill("6");
  await dialog.getByLabel("Did it help? optional").selectOption("helped");
  await dialog.getByLabel("Notes optional").fill("Private note stays home");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog).not.toBeVisible();

  await expect(page.getByRole("button", { name: "Hand off" })).toHaveCount(0);
  await (
    await openChildMenu(page)
  )
    .getByRole("button", { name: "Hand off Your child’s care" })
    .click();
  const sheet = page.getByRole("dialog", { name: /^Hand off/ });
  await expect(
    sheet.getByRole("button", { name: "This illness" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(sheet).toContainText("3 entries");
  await expect(
    sheet.getByAltText("QR code for the hand-off link"),
  ).toBeVisible();
  await expect(sheet.getByRole("note")).toContainText(
    "Anyone with this link or code can see",
  );
  await sheet.getByRole("button", { name: "Copy link" }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/handoff\/#c1\.[A-Za-z0-9_-]+$/);
  expect(url).not.toContain("Private");
  return url;
}

test("a hand-off link opens for someone new, and saving asks for the agreement first", async ({
  page,
  browser,
}, info) => {
  const url = await makeLink(page);

  // A different phone that has never used KiddyMeds.
  const other = await browser.newContext({
    ...(info.project.use.viewport
      ? { viewport: info.project.use.viewport }
      : {}),
    storageState: { cookies: [], origins: [] },
  });
  const recipient = await other.newPage();
  await recipient.goto(url);
  await expect(
    recipient.getByRole("heading", { name: "Your child", exact: true }),
  ).toBeVisible();
  await expect(
    recipient.getByRole("heading", { name: "Before you start" }),
  ).toHaveCount(0);
  await expect(recipient.getByRole("note")).toContainText(
    "Anyone with this link can see this",
  );
  await expect(recipient.locator(".visit-tried")).toContainText("Motrin");
  await expect(recipient.locator(".visit-tried")).toContainText("Helped");
  await expect(recipient.locator(".visit-rows")).toContainText("Fever");
  await expect(recipient.getByText("Private note stays home")).toHaveCount(0);
  const axe = await new AxeBuilder({ page: recipient })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);

  await recipient.getByRole("button", { name: "Save to my KiddyMeds" }).click();
  await expect(
    recipient.getByRole("heading", { name: "Before you start" }),
  ).toBeVisible();
  await recipient.getByLabel(/only under the care of/).check();
  await recipient.getByLabel(/in development and not yet ready/).check();
  await recipient.getByRole("button", { name: "Continue" }).click();
  const review = recipient.getByRole("dialog", { name: "Receive shared care" });
  await expect(review).toContainText("Notes aren’t included");
  // A brand-new phone: the received child is the only option and replaces
  // the empty "Your child" placeholder.
  await expect(review.getByLabel("Receive for")).toHaveValue("new");
  await review.getByRole("button", { name: "Add shared care" }).click();
  await expect(
    recipient.getByRole("heading", {
      name: "Saved to KiddyMeds on this phone",
    }),
  ).toBeVisible();
  const saved = await recipient.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
  );
  expect(saved.logs).toHaveLength(3);
  expect(saved.children).toHaveLength(1);
  expect(saved.settings.activeChildId).toBe(saved.children[0].id);
  await other.close();

  // Opening your own link back: everything is already here, notes are kept.
  await page.goto(url);
  await page.getByRole("button", { name: "Save to my KiddyMeds" }).click();
  const back = page.getByRole("dialog", { name: "Receive shared care" });
  await expect(back.getByLabel("Import review")).toContainText(
    "3 already here",
  );
  await expect(back.getByLabel("Import review")).toContainText("0 differ");
});

test("a Home Screen app receives a hand-off by pasting the link, and opens that child", async ({
  page,
  browser,
}, info) => {
  const url = await makeLink(page);
  const other = await browser.newContext({
    ...(info.project.use.viewport
      ? { viewport: info.project.use.viewport }
      : {}),
    storageState: "tests/e2e/attested.json",
  });
  const recipient = await other.newPage();
  await recipient.goto("/");
  await expect(
    recipient.getByRole("button", { name: /^Switch child/ }),
  ).toBeVisible();
  // Someone who already has a child of their own.
  await recipient.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("kiddymeds_db_v2")!);
    db.children[0].name = "Theo";
    localStorage.setItem("kiddymeds_db_v2", JSON.stringify(db));
  });
  await recipient.reload();
  await (
    await openChildMenu(recipient)
  )
    .getByRole("button", { name: "Receive care" })
    .click();
  const dialog = recipient.getByRole("dialog", { name: "Receive care" });
  await dialog
    .getByRole("textbox")
    .fill(`Here’s the update: ${url.replace("http://", "")} thanks`);
  await dialog.getByRole("button", { name: "Open link" }).click();
  const review = recipient.getByRole("dialog", { name: "Receive shared care" });
  await review.getByLabel("Receive for").selectOption("new");
  await review.getByRole("button", { name: "Add shared care" }).click();
  await expect(review).not.toBeVisible();
  await expect(
    recipient.getByRole("button", {
      name: "Switch child (current: Your child)",
    }),
  ).toBeVisible();
  await expect(recipient.getByText(/^Sick since/)).toBeVisible();
  await other.close();
});

test("a damaged link explains itself", async ({ page }) => {
  await page.goto("/handoff/#c1.broken");
  await expect(
    page.getByRole("heading", { name: "This link couldn’t be opened" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "damaged" }),
  ).toBeVisible();
});
