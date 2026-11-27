import { expect, type Page } from "@playwright/test";

/** The header's child picker: opens the panel if it isn't already open. */
export async function openChildMenu(page: Page) {
  const button = page.getByRole("button", { name: /^Switch child/ });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
  return page.locator("#child-menu-panel");
}
export async function chooseChild(page: Page, name: string) {
  const panel = await openChildMenu(page);
  await panel.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Switch child (current: ${name})` }),
  ).toBeVisible();
}
export async function addChildFromMenu(page: Page, name: string) {
  const panel = await openChildMenu(page);
  await panel.getByRole("button", { name: "Add child", exact: true }).click();
  await page.getByLabel("First name or nickname").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add child", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
export async function editProfileFromMenu(page: Page) {
  const panel = await openChildMenu(page);
  await panel
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
}
