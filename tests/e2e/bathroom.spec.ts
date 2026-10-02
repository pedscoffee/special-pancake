import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("urine records offer all five observations, optional diaper counts and editable reports", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  const choices = [
    "More than usual",
    "Usual amount",
    "Less than usual",
    "Much less, but still peeing",
    "No urine",
  ];
  for (const [i, choice] of choices.entries()) {
    await page
      .getByRole("button", { name: /^Urine / })
      .first()
      .click();
    const observation = dialog.getByLabel(
      "How does peeing compare with usual?",
    );
    await expect(observation).toHaveValue("");
    await observation.selectOption(choice);
    if (choice === "No urine") {
      await expect(dialog.getByLabel("Wet diapers optional")).toBeDisabled();
    } else if (i === 0) {
      await dialog.getByLabel("Wet diapers optional").fill("2");
    }
    await dialog.getByRole("button", { name: "Save entry" }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.reload();
  const logs = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs,
  );
  expect(logs.map((l: { data: { value: string } }) => l.data.value)).toEqual(
    choices,
  );
  expect(logs[0].data.wetDiapers).toBe(2);
  expect(logs[1].data.wetDiapers).toBeUndefined();
  expect(logs[4].data.wetDiapers).toBeUndefined();
  await page.goto("/history/");
  await page
    .getByRole("textbox", { name: "Search care history" })
    .fill("wet diapers");
  await page.getByRole("button", { name: /^Edit Urine at/ }).click();
  await expect(dialog.getByLabel("Wet diapers optional")).toHaveValue("2");
  await expect(dialog.getByLabel("Period covered")).toHaveValue("today");
  await dialog
    .getByLabel("Notes optional")
    .fill("Mixed diaper counted here too");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.goto("/reports/");
  await expect(page.locator(".report-text")).toContainText(
    "More than usual · 2 wet diapers · Today so far · Mixed diaper counted here too",
  );
});

test("stool counts and descriptions persist, export and handle zero output", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Stool / })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Bowel movements", { exact: true }).fill("2");
  await dialog.getByLabel("Stool diapers optional").fill("1");
  await dialog.getByLabel("Stool description optional").selectOption("Mushy");
  await dialog.getByLabel("Period covered").selectOption("since-last");
  await dialog.getByLabel("Notes optional").fill("Mixed diaper after lunch");
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
  await dialog.getByRole("heading").click();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `docs/previews/stool-${info.project.name}.png`,
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  await page.goto("/history/");
  await page.getByRole("button", { name: /^Edit Stool at/ }).click();
  await expect(
    dialog.getByLabel("Bowel movements", { exact: true }),
  ).toHaveValue("2");
  await expect(dialog.getByLabel("Stool diapers optional")).toHaveValue("1");
  await expect(dialog.getByLabel("Stool description optional")).toHaveValue(
    "Mushy",
  );
  await expect(
    dialog.getByLabel("Number of times", { exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloaded;
  expect(await readFile((await download.path())!, "utf8")).toContain(
    "2 bowel movements · 1 stool diaper · Mushy · Since the previous check-in · Mixed diaper after lunch",
  );
  await page.goto("/reports/");
  await expect(page.locator(".report-text")).toContainText(
    "2 bowel movements · 1 stool diaper · Mushy",
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Stool / })
    .first()
    .click();
  await dialog.getByLabel("Bowel movements", { exact: true }).fill("0");
  await expect(dialog.getByLabel("Stool description optional")).toBeDisabled();
  await expect(dialog.getByLabel("Stool diapers optional")).toBeDisabled();
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  const data = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.at(-1).data,
  );
  expect(data.value).toBe("0 bowel movements");
  expect(data.bowelMovements).toBe(0);
  expect(data.stoolConsistency).toBeUndefined();
  expect(data.stoolDiapers).toBeUndefined();
});

test("switching categories clears irrelevant fields and custom periods need notes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Stool / })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Bowel movements", { exact: true }).fill("1");
  await dialog.getByLabel("Stool diapers optional").fill("1");
  await dialog.getByLabel("Stool description optional").selectOption("Watery");
  await dialog.getByLabel("Daily check-in").selectOption("urine");
  await dialog
    .getByLabel("How does peeing compare with usual?")
    .selectOption("Usual amount");
  await dialog.getByLabel("Wet diapers optional").fill("0");
  await dialog.getByLabel("Period covered").selectOption("other");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Describe the period covered in notes.",
  );
  await dialog.getByLabel("Notes optional").fill("Since breakfast");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await page.reload();
  const data = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data,
  );
  expect(data.wetDiapers).toBe(0);
  expect(data.bowelMovements).toBeUndefined();
  expect(data.stoolDiapers).toBeUndefined();
  expect(data.stoolConsistency).toBeUndefined();
  expect(data.observationPeriod).toBe("other");
  expect(data.notes).toBe("Since breakfast");
});

test("previous bathroom counts can be edited without inventing a period or diaper data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("kiddymeds_db_v2"))
      localStorage.setItem(
        "kiddymeds_db_v2",
        JSON.stringify({
          version: 2,
          children: [{ id: "legacy", name: "Emma", color: "sage" }],
          customMedicines: [],
          settings: { timeFormat: "12h", tempUnit: "F" },
          logs: [
            {
              id: "old",
              childId: "legacy",
              type: "METRIC",
              timeGiven: Date.now() - 60000,
              data: { metricType: "urine", value: "4 times" },
            },
          ],
        }),
      );
  });
  await page.goto("/history/");
  await page
    .getByRole("button", { name: /^Edit Bathroom \(previous check-in\) at/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Number of times", { exact: true }),
  ).toHaveValue("4");
  await expect(dialog.getByLabel("Period covered")).toHaveValue("");
  await dialog.getByLabel("Notes optional").fill("Preserved previous count");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  const data = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data,
  );
  expect(data.value).toBe("4 times");
  expect(data.observationPeriod).toBeUndefined();
  expect(data.wetDiapers).toBeUndefined();
  expect(data.notes).toBe("Preserved previous count");
});
