import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a full daily check-in saves four sections together and remains individually editable", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Daily check-in Meals, fluids & bathroom" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Daily check-in",
    exact: true,
  });
  for (const label of [
    "Eating or feeding compared with usual",
    "Drinking compared with usual",
    "How does peeing compare with usual?",
  ])
    await expect(dialog.getByLabel(label)).toHaveValue("");
  await dialog
    .getByLabel("Eating or feeding compared with usual")
    .selectOption("Less than usual");
  await dialog
    .getByLabel("Drinking compared with usual")
    .selectOption("Only small sips or short feeds");
  await dialog
    .getByLabel("How does peeing compare with usual?")
    .selectOption("Much less, but still peeing");
  await dialog.getByLabel("Wet diapers optional").fill("2");
  await dialog.getByLabel("Bowel movements", { exact: true }).fill("1");
  await dialog.getByLabel("Stool diapers optional").fill("1");
  await dialog
    .getByLabel("Stool description optional")
    .selectOption("Soft and formed");
  await dialog.getByLabel("Notes optional").fill("After lunch");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog
    .getByRole("heading", { name: "Daily check-in", exact: true })
    .click();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `docs/previews/checkin-${info.project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const logs = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs,
  );
  expect(logs).toHaveLength(4);
  expect(
    new Set(logs.map((l: { timeGiven: number }) => l.timeGiven)).size,
  ).toBe(1);
  expect(
    logs.map((l: { data: { metricType: string } }) => l.data.metricType),
  ).toEqual(["appetite", "fluids", "urine", "stool"]);
  expect(logs[0].data.wetDiapers).toBeUndefined();
  expect(logs[2].data.wetDiapers).toBe(2);
  expect(logs[3].data.stoolDiapers).toBe(1);
  await page.goto("/history/");
  await page.getByRole("button", { name: /^Edit Fluids at/ }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Period covered"),
  ).toHaveValue("today");
  await page
    .getByRole("dialog")
    .getByLabel("Notes optional")
    .fill("Small sips at lunch");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto("/reports/");
  await expect(page.locator(".report-text")).toContainText(
    "Only small sips or short feeds · Today so far · Small sips at lunch",
  );
});

test("blank sections are skipped, zero output is explicit, and another check-in starts fresh", async ({
  page,
}) => {
  await page.goto("/symptoms/");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const original = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  await expect(dialog.getByRole("alert")).toContainText("at least one section");
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(original);
  await dialog.getByLabel("Bowel movements", { exact: true }).fill("0");
  await expect(dialog.getByLabel("Stool description optional")).toBeDisabled();
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  const logs = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs,
  );
  expect(logs).toHaveLength(1);
  expect(logs[0].data.bowelMovements).toBe(0);
  expect(logs[0].data.stoolDiapers).toBeUndefined();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(
    dialog.getByLabel("Bowel movements", { exact: true }),
  ).toHaveValue("");
  await expect(dialog.getByLabel("Drinking compared with usual")).toHaveValue(
    "",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.length,
    ),
  ).toBe(1);
});

test("a custom period requires context and a storage failure saves no part of the check-in", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Eating or feeding compared with usual")
    .selectOption("Usual amount");
  await dialog
    .getByLabel("Drinking compared with usual")
    .selectOption("Usual amount");
  await dialog.getByLabel("Period covered").selectOption("other");
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Describe the period");
  await dialog.getByLabel("Notes optional").fill("Since breakfast");
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await page.evaluate(() =>
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new DOMException("Storage full", "QuotaExceededError");
      },
    }),
  );
  await dialog.getByRole("button", { name: "Save check-in" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "previous records are unchanged",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
  await expect(dialog).toBeVisible();
});

test("specific observations and scoped symptom counts survive editing and reporting", async ({
  page,
}, info) => {
  await page.goto("/symptoms/");
  await page.getByRole("button", { name: "Cough", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Severity optional")).toHaveValue("");
  await dialog.getByLabel("Cough sound optional").selectOption("Wet or mucusy");
  await dialog.getByLabel("How often? optional").selectOption("In bouts");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await dialog
    .getByRole("heading", { name: "Log symptom", exact: true })
    .click();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `docs/previews/observations-${info.project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.getByRole("button", { name: "Vomiting", exact: true }).click();
  await dialog.getByLabel("Vomiting episodes optional").fill("2");
  await dialog.getByLabel("Count covers").selectOption("Today so far");
  await dialog.getByLabel("Keeping fluids down? optional").selectOption("Some");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Edit Vomiting at/ }).click();
  await expect(dialog.getByLabel("Vomiting episodes optional")).toHaveValue(
    "2",
  );
  await expect(dialog.getByLabel("Count covers")).toHaveValue("Today so far");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: /^Edit Cough at/ }).click();
  await expect(dialog.getByLabel("Cough sound optional")).toHaveValue(
    "Wet or mucusy",
  );
  await expect(dialog.getByLabel("Severity optional")).toHaveValue("");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/reports/");
  await expect(page.locator(".report-text")).toContainText(
    "Cough sound: Wet or mucusy · How often: In bouts",
  );
  await expect(page.locator(".report-text")).toContainText(
    "Vomiting episodes: 2 · Count covers: Today so far · Keeping fluids down: Some",
  );
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs,
  );
  expect(stored[0].data.severity).toBeUndefined();
});

test("changing a symptom clears unrelated details and retains an explicitly chosen severity", async ({
  page,
}) => {
  await page.goto("/symptoms/");
  await page.getByRole("button", { name: "Earache", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Which ear? optional").selectOption("Left");
  await dialog.getByLabel("Severity optional").selectOption("Moderate");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.getByRole("button", { name: /^Edit Earache at/ }).click();
  await dialog.getByLabel("Symptom", { exact: true }).fill("Dizziness");
  await expect(dialog.getByLabel("Which ear? optional")).toHaveCount(0);
  await dialog
    .getByLabel("How do they describe it? optional")
    .selectOption("Spinning");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data,
  );
  expect(stored.symptomName).toBe("Dizziness");
  expect(stored.symptomDetails).toEqual({ feeling: "Spinning" });
  expect(stored.severity).toBe("Moderate");
});
