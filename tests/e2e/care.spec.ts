import { test, expect, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Your child", exact: true }),
  ).toBeVisible();
}
async function openSettings(page: Page) {
  await page.goto("/settings/");
  await expect(
    page.getByRole("heading", { name: "Your little ones" }),
  ).toBeVisible();
}
async function logMedicine(page: Page, name = "Tylenol") {
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Medicine name").fill(name);
  await dialog.getByLabel("Dose optional").fill("As instructed");
  await dialog.getByLabel("Interval in hours optional").fill("6");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog).not.toBeVisible();
}

test("care entries persist, edit correctly, and can be removed with undo", async ({
  page,
}) => {
  await start(page);
  await logMedicine(page);
  await expect(page.getByText("6h interval", { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Edit Tylenol at/ }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Dose optional")
    .fill("Updated recorded dose");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toContainText("Updated recorded dose");
  await page.getByRole("button", { name: /^Edit Tylenol at/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Remove entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toBeVisible();
});
test("children have independent records and can be renamed", async ({
  page,
}) => {
  await start(page);
  await logMedicine(page);
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await page.getByLabel("First name or nickname").fill("Oliver");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add child", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("First name or nickname").fill("Oli");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("button", { name: "Oli", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your child", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toBeVisible();
});
test("temperature preferences convert past readings without changing their source unit", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Symptom The little things you notice" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Symptom", { exact: true })
    .fill("Fever");
  await page.getByLabel("Temperature (°F) optional").fill("100.4");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await openSettings(page);
  await page.getByRole("button", { name: "°C", exact: true }).click();
  await page.goto("/");
  await expect(
    page
      .getByRole("button", { name: /^Edit Fever at/ })
      .getByText("38.0°C", { exact: true }),
  ).toBeVisible();
  const record = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0],
  );
  expect(record.data.tempUnit).toBe("F");
  expect(record.data.temp).toBe("100.4");
  await page.getByRole("button", { name: /^Edit Fever at/ }).click();
  await page.getByLabel("Notes optional").fill("Updated notes, same reading");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const edited = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0],
  );
  expect(edited.data.tempUnit).toBe("F");
  expect(edited.data.temp).toBe("100.4");
});
test("daily check-ins, history search, and reports include care notes", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Daily check-in Meals, fluids & bathroom" })
    .click();
  await page
    .getByLabel("Drinking compared with usual")
    .selectOption("Usual amount");
  await page.getByLabel("Notes optional").fill("Water at breakfast");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/history/");
  await page
    .getByRole("textbox", { name: "Search care history" })
    .fill("breakfast");
  await expect(
    page.getByRole("button", { name: /^Edit Fluids at/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Medicines", exact: true }).click();
  await expect(page.getByText("No matching moments.")).toBeVisible();
  await page.goto("/reports/");
  await expect(page.locator(".report-text")).toContainText(
    "Water at breakfast",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/kiddymeds-.*\.txt$/);
});
test("demo changes never overwrite family records", async ({ page }) => {
  await start(page);
  await logMedicine(page, "My medicine");
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await openSettings(page);
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "Ella’s care, in good hands." }),
  ).toBeVisible();
  await logMedicine(page, "Demo only medicine");
  await expect(
    page.getByRole("button", { name: /^Edit Demo only medicine at/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
  await page
    .getByRole("button", { name: "Leave demo", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /^Edit My medicine at/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
});
test("legacy data migrates automatically and the original is retained", async ({
  page,
}) => {
  const legacy = {
    children: [{ id: "legacy", name: "Emma", color: "var(--col-teal)" }],
    logs: [
      {
        id: "old",
        childId: "legacy",
        type: "MEDICINE",
        timeGiven: Date.now() - 3600000,
        data: {
          medicineName: "Legacy medicine",
          dosage: "Previously recorded",
        },
      },
    ],
    customMedicines: [],
    settings: { timeFormat: "12h" },
  };
  await page.addInitScript(
    (data) => localStorage.setItem("kiddymeds_db_v1", JSON.stringify(data)),
    legacy,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Emma", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Edit Legacy medicine at/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).version,
    ),
  ).toBe(2);
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v1")),
  ).toBe(JSON.stringify(legacy));
});
test("invalid backups are rejected without replacing current care records", async ({
  page,
}) => {
  await start(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await openSettings(page);
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"children":[],"logs":[]}'),
  });
  await expect(page.locator(".form-error")).toContainText("at least one child");
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
});
test("validated backup restores only after the review dialog", async ({
  page,
}) => {
  await start(page);
  await openSettings(page);
  const backup = {
    children: [{ id: "restored", name: "Restored child", color: "mint" }],
    logs: [],
    customMedicines: ["Restored medicine"],
    settings: { timeFormat: "24h", tempUnit: "C" },
  };
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("dialog")).toContainText(
    "1 child · 0 care records",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).children[0].name,
    ),
  ).toBe("Your child");
  await page.getByRole("button", { name: "Restore & replace" }).click();
  await expect(
    page.getByRole("button", { name: /Restored child/ }),
  ).toBeVisible();
});
test("corrupt stored records are preserved and changes cannot silently overwrite them", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kiddymeds_db_v2", "broken data"),
  );
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("left untouched");
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await page.getByLabel("Medicine name").fill("Test medicine");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe("broken data");
});
test("responsive pages fit the viewport and dialogs close with Escape", async ({
  page,
}) => {
  await start(page);
  for (const path of [
    "/",
    "/medicines/",
    "/symptoms/",
    "/history/",
    "/reports/",
    "/settings/",
  ]) {
    await page.goto(path);
    await expect(page.locator(".loading-state")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("offline reload, navigation, and recording work after the initial cache", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit offline navigation bug: https://github.com/microsoft/playwright/issues/42775",
  );
  await start(page);
  await logMedicine(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toBeVisible();
  await page.goto("/index.html");
  await expect(
    page.getByRole("button", { name: /^Edit Tylenol at/ }),
  ).toBeVisible();
  await page
    .locator('a[href="/symptoms/"]')
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "What are you noticing?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fever", exact: true }).click();
  await page.getByLabel("Temperature (°F) optional").fill("100.0");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Edit Fever at/ }),
  ).toBeVisible();
  await expect(page.getByText("You’re offline", { exact: true })).toBeVisible();
});
