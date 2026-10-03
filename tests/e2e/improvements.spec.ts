import { test, expect, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Your child", exact: true }),
  ).toBeVisible();
}

async function medicine(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await page.getByLabel("Medicine name").fill(name);
  await page.getByLabel("Dose optional").fill("My recorded instructions");
  await page.getByLabel("Interval in hours optional").fill("6");
}

for (const kind of ["medicine", "daily check-in"]) {
  test(`an open ${kind} keeps its child when another tab switches profiles`, async ({
    page,
    context,
  }) => {
    await start(page);
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    await page.getByLabel("First name or nickname").fill("Oliver");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add child", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "Your child", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Your child", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const other = await context.newPage();
    await start(other);
    if (kind === "medicine") await medicine(page, "Pinned to this child");
    else {
      await page
        .getByRole("button", {
          name: "Daily check-in Meals, fluids & bathroom",
        })
        .click();
      await page
        .getByLabel("Drinking compared with usual")
        .selectOption("Usual amount");
    }
    await other.getByRole("button", { name: "Oliver", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Oliver", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toContainText("Your child");
    await page
      .getByRole("button", {
        name: kind === "medicine" ? "Save entry" : "Save check-in",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
    );
    expect(saved.logs[0].childId).toBe(
      saved.children.find(
        (child: { name: string }) => child.name === "Your child",
      ).id,
    );
    await other.close();
  });
}

test("a recovered temperature draft keeps its unit after preferences change", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Symptom The little things you notice" })
    .click();
  await page.getByLabel("Symptom", { exact: true }).fill("Fever");
  await page.getByLabel("Temperature (°F) optional").fill("100.4");
  await page.keyboard.press("Escape");
  await page.goto("/settings/");
  await page.getByRole("button", { name: "°C", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "°C", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Symptom The little things you notice" })
    .click();
  await expect(page.getByLabel("Temperature (°F) optional")).toHaveValue(
    "100.4",
  );
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const reading = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data,
  );
  expect(reading.tempUnit).toBe("F");
  expect(reading.temp).toBe("100.4");
});

test("all quick actions are visible before scrolling on a phone", async ({
  page,
}, info) => {
  test.skip(info.project.name === "desktop", "Phone viewport check");
  await start(page);
  for (const name of [
    "Log a medicine",
    "Symptom The little things you notice",
    "Daily check-in Meals, fluids & bathroom",
  ]) {
    const action = page.getByRole("button", { name, exact: true });
    await expect(action).toBeInViewport();
    const box = await action.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("favorites load editable details, stay with their child, and survive backups", async ({
  page,
}) => {
  await start(page);
  await medicine(page, "My medicine");
  await page
    .getByLabel("Save these details as a favorite for Your child")
    .check();
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("region", { name: "Medicine favorites for Your child" })
    .getByRole("button", { name: "My medicine", exact: true })
    .click();
  await expect(page.getByLabel("Dose optional")).toHaveValue(
    "My recorded instructions",
  );
  await expect(page.getByLabel("Interval in hours optional")).toHaveValue("6");
  await expect(
    page.getByText("Favorite details loaded.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Dose optional").fill("Reviewed details");
  await page
    .getByLabel("Save these details as a favorite for Your child")
    .check();
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
  );
  expect(saved.logs).toHaveLength(2);
  expect(saved.medicineFavorites).toHaveLength(1);
  expect(saved.medicineFavorites[0].dosage).toBe("Reviewed details");
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await page.getByLabel("First name or nickname").fill("Oliver");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add child", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Medicine favorites for Oliver" }),
  ).toHaveCount(0);
  await medicine(page, "Other medicine");
  await expect(
    page.getByText("Favorites for Oliver", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/settings/");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(
    JSON.parse(Buffer.concat(chunks).toString()).medicineFavorites,
  ).toEqual(saved.medicineFavorites);
  await page.goto("/medicines/");
  await page.getByRole("button", { name: "Your child", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove My medicine favorite", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Medicine favorites for Your child" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.length,
    ),
  ).toBe(2);
});

test("two tabs preserve both saves", async ({ context, page }) => {
  await context.addInitScript(() => {
    window.addEventListener("storage", (event) =>
      event.stopImmediatePropagation(),
    );
  });
  await start(page);
  const other = await context.newPage();
  await start(other);
  await medicine(page, "First tab medicine");
  await medicine(other, "Second tab medicine");
  await Promise.all([
    page.getByRole("button", { name: "Save entry" }).click(),
    other.getByRole("button", { name: "Save entry" }).click(),
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(other.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(async () => {
      return page.evaluate(() =>
        JSON.parse(localStorage.getItem("kiddymeds_db_v2")!)
          .logs.map(
            (log: { data: { medicineName: string } }) => log.data.medicineName,
          )
          .sort(),
      );
    })
    .toEqual(["First tab medicine", "Second tab medicine"]);
  await expect
    .poll(async () =>
      other.evaluate(
        () => JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs.length,
      ),
    )
    .toBe(2);
  await other.close();
});

test("older edits cannot replace newer edits and drafts retain the old baseline", async ({
  context,
  page,
}) => {
  await start(page);
  await medicine(page, "Shared medicine");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const other = await context.newPage();
  await start(other);
  await page.getByRole("button", { name: /^Edit Shared medicine at/ }).click();
  await other.getByRole("button", { name: /^Edit Shared medicine at/ }).click();
  await page.getByLabel("Notes optional").fill("Older unsaved notes");
  await other.getByLabel("Notes optional").fill("Newer saved notes");
  await other.getByRole("button", { name: "Save changes" }).click();
  await expect(other.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".error-banner")).toContainText(
    "changed in another tab",
  );
  await expect(page.getByLabel("Notes optional")).toHaveValue(
    "Older unsaved notes",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data.notes,
    ),
  ).toBe("Newer saved notes");
  await page.reload();
  await page.getByRole("button", { name: /^Edit Shared medicine at/ }).click();
  await expect(
    page.getByText("An unfinished edit belongs to an older version", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes optional")).toHaveValue(
    "Newer saved notes",
  );
  await other.close();
});

test("unfinished medicine and daily forms survive closing and reload, then clear after save or cancel", async ({
  page,
}) => {
  await start(page);
  await medicine(page, "Unfinished medicine");
  await page.getByLabel("Notes optional").fill("Do not lose this");
  const time = await page.getByLabel("When", { exact: true }).inputValue();
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await expect(page.getByLabel("Medicine name")).toHaveValue(
    "Unfinished medicine",
  );
  await expect(page.getByLabel("Dose optional")).toHaveValue(
    "My recorded instructions",
  );
  await expect(page.getByLabel("Notes optional")).toHaveValue(
    "Do not lose this",
  );
  await expect(page.getByLabel("When", { exact: true })).toHaveValue(time);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Log a medicine", exact: true })
    .click();
  await expect(page.getByLabel("Medicine name")).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Daily check-in Meals, fluids & bathroom" })
    .click();
  await page
    .getByLabel("Eating or feeding compared with usual")
    .selectOption("Less than usual");
  await page
    .getByLabel("How does peeing compare with usual?")
    .selectOption("Usual amount");
  await page.getByLabel("Wet diapers optional").fill("2");
  await page.getByLabel("Notes optional").fill("Unfinished check-in");
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Daily check-in Meals, fluids & bathroom" })
    .click();
  await expect(
    page.getByLabel("Eating or feeding compared with usual"),
  ).toHaveValue("Less than usual");
  await expect(
    page.getByLabel("How does peeing compare with usual?"),
  ).toHaveValue("Usual amount");
  await expect(page.getByLabel("Wet diapers optional")).toHaveValue("2");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Daily check-in Meals, fluids & bathroom" })
    .click();
  await expect(
    page.getByLabel("Eating or feeding compared with usual"),
  ).toHaveValue("");
  await expect(
    page.getByLabel("How does peeing compare with usual?"),
  ).toHaveValue("");
});

test("restoring a backup cannot discard records added after the review opened", async ({
  page,
  context,
}) => {
  await start(page);
  const other = await context.newPage();
  await start(other);
  await page.goto("/settings/");
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        children: [{ id: "backup", name: "Backup child", color: "sage" }],
        logs: [],
        customMedicines: [],
      }),
    ),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await medicine(other, "New entry during review");
  await other.getByRole("button", { name: "Save entry" }).click();
  await expect(other.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Restore & replace" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".error-banner")).toContainText(
    "changed after you opened this review",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kiddymeds_db_v2")!).logs[0].data
          .medicineName,
    ),
  ).toBe("New entry during review");
  await other.close();
});
