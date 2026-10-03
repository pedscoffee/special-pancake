import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { careFileText, makeCareShare, readCareFile } from "../../lib/sharing";
import type { Database } from "../../lib/types";

function fixture(): Database {
  const now = Date.now() - 60000;
  return {
    version: 2,
    children: [
      { id: "ella", name: "Ella", color: "sage" },
      { id: "oli", name: "Oliver", color: "blue" },
    ],
    settings: { timeFormat: "12h", tempUnit: "F", activeChildId: "ella" },
    customMedicines: [],
    logs: [
      {
        id: "medicine",
        childId: "ella",
        type: "MEDICINE",
        timeGiven: now,
        timestamp: now,
        data: {
          medicineName: "Tylenol",
          dosage: "As instructed",
          notes: "Resting after lunch",
        },
      },
      {
        id: "fever",
        childId: "ella",
        type: "SYMPTOM",
        timeGiven: now - 60000,
        timestamp: now,
        data: { symptomName: "Fever", temp: "38", tempUnit: "C" },
      },
      {
        id: "other-child",
        childId: "oli",
        type: "SYMPTOM",
        timeGiven: now,
        timestamp: now,
        data: { symptomName: "Private observation" },
      },
    ],
  };
}
async function seed(page: Page, db: Database) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("kiddymeds_db_v2"))
      localStorage.setItem("kiddymeds_db_v2", JSON.stringify(data));
  }, db);
}
async function received(page: Page, text: string) {
  await page.getByLabel("Choose shared care file").setInputFiles({
    name: "shared-care.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByRole("dialog", { name: "Receive shared care" }),
  ).toBeVisible();
}

test("share preview, email draft, readable download and receiving preserve local care", async ({
  page,
}, info) => {
  const source = fixture();
  await seed(page, source);
  await page.goto("/reports/");
  await page.getByRole("button", { name: "Share care", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Personal message optional")
    .fill("Here’s today’s care before your turn.");
  await dialog.locator(".share-preview summary").click();
  await expect(
    dialog.getByRole("region", { name: "Share message preview" }),
  ).toBeVisible();
  await expect(dialog.locator(".share-preview")).toContainText(
    "Ella’s care update",
  );
  await expect(dialog.locator(".share-preview")).toContainText("100.4°F");
  await expect(dialog.locator(".share-preview")).not.toContainText(
    "Private observation",
  );
  const href = await dialog
    .getByRole("link", { name: "Email draft" })
    .getAttribute("href");
  expect(decodeURIComponent(href!)).toContain(
    "Here’s today’s care before your turn.",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.locator(".share-preview summary").click();
  await dialog.getByRole("heading", { name: "Share a little care" }).click();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `docs/previews/sharing-${info.project.name}.png`,
  });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download care file" }).click();
  const download = await downloading;
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("Receive care");
  expect(text).toContain("Here’s today’s care before your turn.");
  expect(text).not.toContain("Private observation");
  expect(readCareFile(text).logs).toHaveLength(2);
  expect(
    readCareFile(text).logs.find((l) => l.id === "fever")!.data.tempUnit,
  ).toBe("C");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  const recipient = fixture();
  recipient.children = [
    { id: "my-ella", name: "My Ella", color: "rose" },
    recipient.children[1],
  ];
  recipient.logs = [recipient.logs[2]];
  recipient.settings = {
    timeFormat: "24h",
    tempUnit: "C",
    activeChildId: "my-ella",
  };
  await page.evaluate(
    (data) => localStorage.setItem("kiddymeds_db_v2", JSON.stringify(data)),
    recipient,
  );
  await page.reload();
  await received(page, text);
  await expect(
    dialog.getByRole("button", { name: "Add shared care" }),
  ).toBeDisabled();
  await dialog.getByLabel("Receive for").selectOption("existing:my-ella");
  await expect(dialog.locator(".receive-counts")).toContainText("2 new");
  const reviewAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    reviewAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Add shared care" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const merged = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
  );
  expect(merged.logs).toHaveLength(3);
  expect(merged.children).toEqual(recipient.children);
  expect(merged.settings).toEqual(recipient.settings);
  expect(
    merged.logs.find((l: { id: string }) => l.id === "fever").childId,
  ).toBe("my-ella");
  await received(page, text);
  await dialog.getByLabel("Receive for").selectOption("existing:my-ella");
  await expect(dialog.locator(".receive-counts")).toContainText(
    "2 already here",
  );
  await expect(
    dialog.getByRole("button", { name: "Add shared care" }),
  ).toBeDisabled();
});

test("native share receives the selected snapshot; cancellation and unsupported attachments have clear fallbacks", async ({
  page,
}) => {
  await seed(page, fixture());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: unknown }).shared = {
          text: data.text,
          title: data.title,
          name: data.files?.[0]?.name,
          file: await data.files?.[0]?.text(),
        };
      },
    });
  });
  await page.goto("/reports/");
  await page.getByLabel("Include", { exact: false }).selectOption("SYMPTOM");
  await page.getByRole("button", { name: "Share care", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Share message & care file" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Handed to your device",
  );
  const shared = await page.evaluate(
    () =>
      (
        window as unknown as {
          shared: { text: string; name: string; file: string };
        }
      ).shared,
  );
  expect(shared.name).toMatch(/\.txt$/);
  expect(shared.text).toContain("Ella’s care update");
  expect(shared.text).not.toContain("Tylenol");
  expect(readCareFile(shared.file).logs.map((l) => l.id)).toEqual(["fever"]);
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Canceled", "AbortError");
      },
    }),
  );
  await dialog
    .getByRole("button", { name: "Share message & care file" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Sharing canceled");
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: unknown }).shared = data;
      },
    });
  });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Share care", exact: true }).click();
  await expect(dialog).toContainText("download the care file and attach it");
  await dialog
    .getByRole("button", { name: "Share message", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: ShareData }).shared.files,
    ),
  ).toBeUndefined();
});

test("receiving validates files and requires a choice for differing records", async ({
  page,
}) => {
  const source = fixture();
  const text = careFileText(
    makeCareShare(source, "ella", "", ""),
    source.settings,
    "https://example.com/",
  );
  source.logs[0].data.notes = "My version of the observation";
  await seed(page, source);
  await page.goto("/reports/");
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await page.getByLabel("Choose shared care file").setInputFiles({
    name: "broken.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not valid"),
  });
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "couldn’t be read",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
  await received(page, text);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Add shared care" }),
  ).toBeDisabled();
  await expect(dialog.locator(".receive-counts")).toContainText("1 differ");
  await dialog.getByRole("radio", { name: /^Use shared version/ }).check();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Add shared care" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
  );
  expect(stored.logs).toHaveLength(3);
  expect(
    stored.logs.find((l: { id: string }) => l.id === "medicine").data.notes,
  ).toBe("Resting after lunch");
});

test("desktop fallback lets users copy the message when the share sheet is unavailable", async ({
  page,
}) => {
  await seed(page, fixture());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Unavailable");
        },
      },
    });
  });
  await page.goto("/reports/");
  await page.getByRole("button", { name: "Share care", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Copy message", exact: true })
    .click();
  await expect(dialog.getByLabel("Share message to copy")).toContainText(
    "Ella’s care update",
  );
  await expect(dialog.getByRole("status")).toContainText("Select and copy");
  await expect(
    dialog.getByRole("button", { name: "Download care file" }),
  ).toBeEnabled();
});

test("receiving a new child saves only after storage accepts the merge", async ({
  page,
}) => {
  const source = fixture();
  const text = careFileText(
    makeCareShare(source, "ella", "", ""),
    source.settings,
    "https://example.com/",
  );
  const recipient = fixture();
  recipient.children = [recipient.children[1]];
  recipient.logs = [recipient.logs[2]];
  recipient.settings.activeChildId = "oli";
  await seed(page, recipient);
  await page.goto("/reports/");
  const before = await page.evaluate(() =>
    localStorage.getItem("kiddymeds_db_v2"),
  );
  await received(page, text);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Receive for").selectOption("new");
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new DOMException("Storage full", "QuotaExceededError");
      },
    });
  });
  await dialog.getByRole("button", { name: "Add shared care" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "existing records were left unchanged",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kiddymeds_db_v2")),
  ).toBe(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page
      .getByRole("group", { name: "Choose a child" })
      .getByRole("button", { name: "Ella", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await received(page, text);
  await dialog.getByLabel("Receive for").selectOption("new");
  await dialog.getByRole("button", { name: "Add shared care" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const merged = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiddymeds_db_v2")!),
  );
  expect(merged.children).toHaveLength(2);
  expect(merged.logs).toHaveLength(3);
  expect(merged.settings).toEqual(recipient.settings);
  expect(
    merged.logs.find((l: { id: string }) => l.id === "other-child"),
  ).toEqual(recipient.logs[0]);
});
