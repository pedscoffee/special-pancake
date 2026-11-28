import { test, expect, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Switch child (current: Your child)" }),
  ).toBeVisible();
}

test("a family records an illness and the report summarizes it for the doctor", async ({
  page,
}) => {
  await start(page);
  // Mark the illness start.
  await page.getByRole("button", { name: "Got sick", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Notes optional").fill("Warm after daycare");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/^Sick since .+ · day 1$/).first()).toBeVisible();

  // A fever, a medicine with an answer, and a check-in with "not seen" checks.
  await page
    .getByRole("button", { name: "Log a symptom", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Symptom", { exact: true }).fill("Fever");
  await dialog.getByRole("spinbutton", { name: /^Temperature/ }).fill("102.2");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog).not.toBeVisible();

  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Medicine name").fill("Motrin");
  await dialog.getByLabel("Interval in hours optional").fill("6");
  await dialog.getByLabel("Did it help? optional").selectOption("helped");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog).not.toBeVisible();

  await page
    .getByRole("button", { name: "Daily check-in", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Drinking compared with usual")
    .selectOption("Less than usual");
  await dialog.getByLabel("No vomiting").check();
  await dialog.getByLabel("No diarrhea").check();
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  await expect(dialog).not.toBeVisible();

  // History shows the new entries, and they open their own editor.
  await page.goto("/history/");
  await page.getByRole("button", { name: /^Edit No vomiting at/ }).click();
  await expect(
    page.getByRole("heading", { name: "Edit “No vomiting”" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/reports/");
  const summary = page.locator(".visit-summary");
  await expect(summary.getByText(/^Sick since .+ · day 1$/)).toBeVisible();
  const row = (label: string) =>
    summary.locator(".visit-row").filter({
      has: page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) }),
    });
  await expect(row("Fever")).toContainText("today");
  await expect(row("Fever")).toContainText("Highest 102.2°F today");
  await expect(row("Drinking")).toContainText("Less than usual today");
  await expect(row("Vomiting")).toContainText("None");
  await expect(row("Vomiting")).toContainText("Checked today");
  // Only what was recorded appears: nothing about rash was entered.
  await expect(row("Rash")).toHaveCount(0);
  await expect(row("Eating")).toHaveCount(0);
  await expect(summary.locator(".visit-tried")).toContainText("Motrin");
  await expect(summary.locator(".visit-tried")).toContainText("Helped");

  // Questions are kept with the child and included in the copied report.
  await summary.getByLabel("OUR QUESTIONS").fill("Can she go to daycare?");
  await summary.getByLabel("OUR QUESTIONS").blur();
  await expect(page.getByText("Questions saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".visit-summary").getByLabel("OUR QUESTIONS"),
  ).toHaveValue("Can she go to daycare?");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy summary" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^SICK-VISIT SUMMARY — Your child/);
  expect(copied).toContain("Vomiting: None (Checked today)");
  expect(copied).toContain("Our questions:\nCan she go to daycare?");
  expect(copied).not.toContain("EVERY ENTRY");
  expect(copied).not.toContain("Rash");

  // Feeling better closes the illness, from the illness line's options.
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Feeling better", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Illness options$/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Your child is feeling better" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Got sick" })).toBeVisible();
});

test("after two quiet days the overview asks whether the child is better", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("kiddymeds_db_v2")!);
    const childId = db.children[0].id;
    const at = Date.now() - 3 * 86400000;
    db.logs.push(
      {
        id: "ill",
        childId,
        type: "METRIC",
        timeGiven: at,
        timestamp: at,
        data: { metricType: "illness", value: "Started" },
      },
      {
        id: "fever",
        childId,
        type: "SYMPTOM",
        timeGiven: at + 3600000,
        timestamp: at,
        data: { symptomName: "Fever", temp: "101", tempUnit: "F" },
      },
    );
    localStorage.setItem("kiddymeds_db_v2", JSON.stringify(db));
  });
  await page.reload();
  const ask = page.getByRole("group", {
    name: "Is Your child feeling better?",
  });
  await expect(ask).toBeVisible();
  // Still sick waits for two more quiet days.
  await ask.getByRole("button", { name: "Still sick" }).click();
  await expect(ask).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Illness options$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(ask).toHaveCount(0);
  // Feeling better ends the illness.
  await page.evaluate(() => localStorage.removeItem("kiddymeds-still-sick"));
  await page.reload();
  await ask.getByRole("button", { name: "Feeling better" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", { name: "Got sick", exact: true }),
  ).toBeVisible();
});

test("the overview asks whether a recent medicine helped", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("kiddymeds_db_v2")!);
    db.logs.push({
      id: "med-1",
      childId: db.children[0].id,
      type: "MEDICINE",
      timeGiven: Date.now() - 2 * 3600000,
      timestamp: Date.now() - 2 * 3600000,
      data: { medicineName: "Tylenol", frequencyHours: 6, notes: "" },
    });
    localStorage.setItem("kiddymeds_db_v2", JSON.stringify(db));
  });
  await page.reload();
  const card = page.getByRole("group", {
    name: /^Did the Tylenol at .+ help\?$/,
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Helped a little" }).click();
  await expect(card).not.toBeVisible();
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data
        .response,
  );
  expect(stored).toBe("a-little");

  // Tapping the clock offers Give again, Edit, and an always-generic calendar alert.
  await page.getByRole("button", { name: /^Tylenol: .+ Options$/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Give again" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /calendar alert for the end of the recorded Tylenol interval/,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("KiddyMeds reminder");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download event" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("kiddymeds-reminder.ics");
  const ics = await (
    await import("node:fs/promises")
  ).readFile((await file.path())!, "utf8");
  expect(ics).toContain("SUMMARY:KiddyMeds reminder");
  expect(ics).not.toContain("Tylenol");
});

test("the demo shows a complete sick-visit summary first on a phone", async ({
  page,
}, info) => {
  await page.goto("/settings/");
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await page
    .locator('a[href="/reports/"]')
    .filter({ visible: true })
    .first()
    .click();
  const summary = page.locator(".visit-summary");
  await expect(summary.getByText(/^Sick since .+ · day 4$/)).toBeVisible();
  await expect(summary.locator(".visit-row.noticed").first()).toBeVisible();
  await expect(summary.locator(".visit-tried")).toContainText("Helped");
  // The full log and sharing live in History now.
  await expect(page.getByRole("button", { name: "Share care" })).toHaveCount(0);
  // The report fits a phone screen without sideways scrolling.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/previews/visit-summary-${info.project.name}.png`,
    fullPage: true,
  });
});
