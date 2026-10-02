import { test, expect } from "@playwright/test";
import { SYMPTOM_PRESETS } from "../../lib/symptoms";

test("every symptom has a distinct icon shared by observations, overview and history", async ({
  page,
}) => {
  await page.goto("/symptoms/");
  await expect(page.locator(".symptom-tile")).toHaveCount(
    SYMPTOM_PRESETS.length,
  );
  const icons = new Set<string>();
  for (const preset of SYMPTOM_PRESETS.filter(
    (s) => s.name !== "Other symptom",
  )) {
    const tile = page.getByRole("button", { name: preset.name, exact: true });
    const svg = await tile.locator(".icon-box svg").innerHTML();
    icons.add(svg);
    await tile.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Symptom", { exact: true })).toHaveValue(
      preset.name,
    );
    if (preset.name === "Fever")
      await dialog.getByLabel("Temperature (°F) optional").fill("100.4");
    else await dialog.getByLabel("Severity").selectOption("Moderate");
    if (preset.name === "Pain")
      await dialog
        .getByPlaceholder("Where does it hurt? Anything else you noticed…")
        .fill("Left knee after playing");
    await dialog.getByRole("button", { name: "Save entry" }).click();
    const record = page.getByRole("button", {
      name: new RegExp(`^Edit ${preset.name} at`),
    });
    await expect(record).toBeVisible();
    expect(await record.locator(".icon-box svg").innerHTML()).toBe(svg);
  }
  expect(icons.size).toBe(SYMPTOM_PRESETS.length - 1);
  await page.reload();
  const rows = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs,
  );
  expect(rows).toHaveLength(SYMPTOM_PRESETS.length - 1);
  expect(
    rows.find(
      (r: { data: { symptomName: string } }) => r.data.symptomName === "Pain",
    ).data.notes,
  ).toBe("Left knee after playing");
  for (const route of ["/", "/history/"]) {
    await page.goto(route);
    const record = page.getByRole("button", { name: /^Edit Itching at/ });
    const icon = await record.locator(".icon-box svg").innerHTML();
    expect(icons.has(icon)).toBe(true);
    expect(
      await record.locator(".icon-box svg").getAttribute("aria-hidden"),
    ).toBe("true");
  }
});

test("symptom filters support synonyms and unmatched observations can still be recorded", async ({
  page,
}) => {
  await page.goto("/symptoms/");
  await page.getByRole("button", { name: "Skin", exact: true }).click();
  await expect(page.locator(".symptom-tile")).toHaveCount(2);
  await page.getByRole("textbox", { name: "Find a symptom" }).fill("itchy");
  await expect(page.locator(".symptom-tile")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Itching", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All symptoms", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Find a symptom" })
    .fill("stuffy nose");
  await expect(
    page.getByRole("button", { name: "Congestion", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".symptom-tile")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Find a symptom" })
    .fill("My own observation");
  await expect(page.locator(".symptom-tile")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Log “My own observation”", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Symptom", { exact: true })).toHaveValue(
    "My own observation",
  );
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  const record = page.getByRole("button", {
    name: /^Edit My own observation at/,
  });
  await expect(record).toBeVisible();
  await expect(record.locator(".lucide-activity")).toHaveCount(1);
  await page.getByRole("button", { name: "Log symptom", exact: true }).click();
  await dialog.getByLabel("Symptom", { exact: true }).fill("  ear PAIN  ");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  const ear = page.getByRole("button", { name: /^Edit ear PAIN at/ });
  await expect(ear.locator(".lucide-ear")).toHaveCount(1);
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.at(-1).data
        .symptomName,
  );
  expect(stored).toBe("ear PAIN");
});

test("capture the expanded symptom library", async ({ page }, info) => {
  await page.goto("/symptoms/");
  await expect(page.locator(".symptom-tile")).toHaveCount(
    SYMPTOM_PRESETS.length,
  );
  await expect(
    page.getByRole("heading", { name: "What are you noticing?" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/previews/symptoms-${info.project.name}.png`,
    fullPage: true,
  });
});
