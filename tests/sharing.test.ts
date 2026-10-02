import { test } from "node:test";
import assert from "node:assert/strict";
import {
  careFileName,
  careFileText,
  careShareMessage,
  makeCareShare,
  mergeCareShare,
  parseCareShare,
  planCareMerge,
  readCareFile,
  recordSignature,
  SHARE_MARKER,
} from "../lib/sharing";
import type { Database } from "../lib/types";

const now = new Date("2026-10-02T12:00:00").getTime();
const day = "2026-10-02";
function db(): Database {
  return {
    version: 2,
    children: [
      { id: "ella", name: "Ella", color: "sage", birthday: "2022-03-14" },
      { id: "oli", name: "Oliver", color: "blue" },
    ],
    settings: { timeFormat: "24h", tempUnit: "C", activeChildId: "ella" },
    customMedicines: ["Private shortcut"],
    logs: [
      {
        id: "medicine",
        childId: "ella",
        type: "MEDICINE",
        timeGiven: now - 60000,
        timestamp: now,
        data: {
          medicineName: "Tylenol",
          dosage: "Recorded dose",
          notes: "Resting well",
        },
      },
      {
        id: "fever",
        childId: "ella",
        type: "SYMPTOM",
        timeGiven: now - 120000,
        timestamp: now,
        data: { symptomName: "Fever", temp: "38.2", tempUnit: "C" },
      },
      {
        id: "stool",
        childId: "ella",
        type: "METRIC",
        timeGiven: now - 180000,
        timestamp: now,
        data: {
          metricType: "stool",
          value: "2 bowel movements",
          bowelMovements: 2,
          stoolDiapers: 1,
          stoolConsistency: "Mushy",
          observationPeriod: "today",
        },
      },
      {
        id: "older",
        childId: "ella",
        type: "SYMPTOM",
        timeGiven: now - 86400000,
        timestamp: now,
        data: { symptomName: "Cough" },
      },
      {
        id: "other-child",
        childId: "oli",
        type: "SYMPTOM",
        timeGiven: now - 60000,
        timestamp: now,
        data: { symptomName: "Private symptom" },
      },
    ],
  };
}

test("shares contain only the selected child, period and category, with no preferences or shortcuts", () => {
  const share = makeCareShare(db(), "ella", day, day, "SYMPTOM", now);
  assert.deepEqual(
    share.logs.map((l) => l.id),
    ["fever"],
  );
  assert.equal(share.child.birthday, undefined);
  assert.ok(!JSON.stringify(share).includes("Private"));
  assert.equal(share.logs[0].data.tempUnit, "C");
  assert.throws(() => makeCareShare(db(), "missing", day, day));
  assert.throws(() => makeCareShare(db(), "ella", "2030-01-01", "2030-01-01"));
});

test("readable care files round-trip full records, notes, original units and bathroom details", () => {
  const share = makeCareShare(db(), "ella", day, day, "all", now);
  share.logs[0].data.notes = `Unicode ♥\nA note with a marker ${SHARE_MARKER} and <script>plain text</script>`;
  const text = careFileText(
    share,
    db().settings,
    "https://example.com/",
    "Today’s handoff",
  );
  assert.match(text, /Today’s handoff/);
  assert.match(text, /2 bowel movements · 1 stool diaper · Mushy/);
  assert.match(text, /38\.2°C/);
  assert.match(text, /Receive care/);
  assert.equal(JSON.stringify(readCareFile(text)), JSON.stringify(share));
  assert.deepEqual(readCareFile(text.replace(/\n/g, "\r\n")), share);
  assert.equal(readCareFile(JSON.stringify(share)).logs.length, 3);
  assert.match(careFileName(share), /^kiddymeds-Ella-care-2026-10-02\.txt$/);
  const reordered = {
    ...share.logs[0],
    data: {
      notes: share.logs[0].data.notes,
      dosage: "Recorded dose",
      medicineName: "Tylenol",
    },
  };
  assert.equal(recordSignature(reordered), recordSignature(share.logs[0]));
});

test("message summaries are bounded and distinguish snapshots from full files", () => {
  const source = db();
  source.logs = Array.from({ length: 10 }, (_, i) => ({
    ...source.logs[0],
    id: `log-${i}`,
    timeGiven: now - i * 60000,
    data: { medicineName: "Tylenol", notes: "A".repeat(5000) },
  }));
  const share = makeCareShare(source, "ella", day, day, "all", now);
  const summary = careShareMessage(share, source.settings, "Your turn");
  assert.ok(summary.startsWith("Your turn\nElla’s care update"));
  assert.match(summary, /4 more entries/);
  assert.match(summary, /won’t appear automatically/);
  assert.ok(summary.length < 2200);
  assert.ok(
    careFileText(share, source.settings, "https://example.com/").includes(
      "A".repeat(5000),
    ),
  );
});

test("invalid, unlinked, empty and incompatible care files cannot be merged", () => {
  const share = makeCareShare(db(), "ella", day, day, "all", now);
  for (const value of [
    null,
    {},
    db(),
    { ...share, version: 99 },
    { ...share, logs: [] },
    { ...share, sharedAt: "today" },
    { ...share, from: "2026-02-31" },
    { ...share, from: "2026-10-03", to: day },
    { ...share, logs: [{ ...share.logs[0], childId: "oli" }] },
    {
      ...share,
      logs: [
        { ...share.logs[1], data: { symptomName: "Fever", temp: "38.2" } },
      ],
    },
  ])
    assert.throws(() => parseCareShare(value));
  assert.throws(() => readCareFile("Some ordinary text"));
  assert.throws(() => readCareFile(SHARE_MARKER + "{}"));
});

test("merging preserves other children, local records and personal preferences, and repeated imports deduplicate", () => {
  const source = db();
  const share = makeCareShare(source, "ella", day, day, "all", now);
  const receiver = db();
  receiver.children = [
    { id: "recipient-child", name: "My Ella", color: "rose" },
    source.children[1],
  ];
  receiver.logs = [source.logs[4]];
  receiver.settings = {
    timeFormat: "12h",
    tempUnit: "F",
    activeChildId: "oli",
  };
  const before = JSON.stringify(receiver);
  const merged = mergeCareShare(receiver, share, "recipient-child", {});
  assert.equal(JSON.stringify(receiver), before);
  assert.equal(merged.logs.length, 4);
  assert.deepEqual(merged.settings, receiver.settings);
  assert.deepEqual(merged.children, receiver.children);
  assert.deepEqual(merged.customMedicines, receiver.customMedicines);
  assert.equal(merged.logs.find((l) => l.id === "fever")!.data.tempUnit, "C");
  assert.equal(
    merged.logs.find((l) => l.id === "fever")!.childId,
    "recipient-child",
  );
  assert.equal(merged.logs.find((l) => l.id === "stool")!.data.stoolDiapers, 1);
  assert.equal(
    planCareMerge(merged, share, "recipient-child").duplicates.length,
    3,
  );
  assert.equal(
    mergeCareShare(merged, share, "recipient-child", {}).logs.length,
    4,
  );
  assert.throws(() => mergeCareShare(receiver, share, "missing", {}));
});

test("new profiles are explicit and conflicting cross-child IDs cannot move observations", () => {
  const share = makeCareShare(db(), "ella", day, day, "all", now);
  const receiver = db();
  receiver.children = [receiver.children[1]];
  receiver.logs = [receiver.logs[4]];
  const merged = mergeCareShare(receiver, share, null, {});
  assert.equal(merged.children.length, 2);
  assert.equal(merged.children[1].name, "Ella");
  assert.throws(() => mergeCareShare(merged, share, null, {}));
  receiver.logs.push({ ...share.logs[0], childId: "oli" });
  assert.throws(() => mergeCareShare(receiver, share, null, {}));
});

test("differing entries require an explicit current choice rather than silently overwriting", () => {
  const source = db();
  const share = makeCareShare(source, "ella", day, day, "all", now);
  const receiver = db();
  receiver.logs[0].data.notes = "My local observation";
  const plan = planCareMerge(receiver, share, "ella");
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.duplicates.length, 2);
  assert.throws(() => mergeCareShare(receiver, share, "ella", {}));
  const localSignature = recordSignature(receiver.logs[0]);
  assert.equal(
    mergeCareShare(receiver, share, "ella", {
      medicine: { keep: "local", localSignature },
    }).logs[0].data.notes,
    "My local observation",
  );
  assert.equal(
    mergeCareShare(receiver, share, "ella", {
      medicine: { keep: "incoming", localSignature },
    }).logs[0].data.notes,
    "Resting well",
  );
  receiver.logs[0].data.notes = "Changed while reviewing";
  assert.throws(() =>
    mergeCareShare(receiver, share, "ella", {
      medicine: { keep: "incoming", localSignature },
    }),
  );
});
