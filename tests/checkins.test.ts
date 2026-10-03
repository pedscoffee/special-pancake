import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDailyCheckIn,
  buildDailyCheckIn,
  type DailyDraft,
} from "../lib/daily-checkin";
import {
  demoDatabase,
  filterLogs,
  logDetail,
  makeReport,
  parseDatabase,
} from "../lib/care";
import { symptomObservation } from "../lib/symptom-observations";
import { SYMPTOM_PRESETS } from "../lib/symptoms";
import {
  careFileText,
  makeCareShare,
  mergeCareShare,
  readCareFile,
} from "../lib/sharing";
import type { Log } from "../lib/types";

const now = new Date("2026-10-02T12:00:00").getTime();
const draft: DailyDraft = {
  childId: "demo-ella",
  timeGiven: now - 3600000,
  period: "today",
  notes: "At lunch",
  appetite: "",
  fluids: "",
  urine: "",
};

test("one check-in adds all answered sections at one time and preserves existing care", () => {
  const db = demoDatabase(now);
  const original = JSON.stringify(db);
  const records = buildDailyCheckIn(
    {
      ...draft,
      appetite: "Less than usual",
      fluids: "Only small sips or short feeds",
      urine: "Usual amount",
      wetDiapers: 2,
      bowelMovements: 1,
      stoolDiapers: 1,
      stoolConsistency: "Soft and formed",
    },
    now,
  );
  assert.equal(records.length, 4);
  assert.equal(new Set(records.map((l) => l.id)).size, 4);
  assert.ok(
    records.every(
      (l) =>
        l.timeGiven === draft.timeGiven &&
        l.data.observationPeriod === "today" &&
        l.data.notes === "At lunch",
    ),
  );
  assert.equal(records[0].data.wetDiapers, undefined);
  assert.equal(records[2].data.wetDiapers, 2);
  assert.equal(records[3].data.bowelMovements, 1);
  const next = addDailyCheckIn(db, records);
  assert.equal(JSON.stringify(db), original);
  assert.equal(next.logs.length, db.logs.length + 4);
  assert.deepEqual(next.settings, db.settings);
  assert.deepEqual(next.logs.slice(0, db.logs.length), parseDatabase(db).logs);
  assert.match(
    makeReport("Ella", records, db.settings, "", ""),
    /Only small sips or short feeds/,
  );
});

test("blank daily sections are skipped; explicit zero output is retained without combining snapshots", () => {
  const records = buildDailyCheckIn(
    { ...draft, fluids: "Usual amount", bowelMovements: 0 },
    now,
  );
  assert.deepEqual(
    records.map((l) => l.data.metricType),
    ["fluids", "stool"],
  );
  assert.equal(records[1].data.bowelMovements, 0);
  assert.equal(records[1].data.stoolDiapers, undefined);
  const db = demoDatabase(now);
  const twice = addDailyCheckIn(
    addDailyCheckIn(db, records),
    buildDailyCheckIn(
      { ...draft, fluids: "Usual amount", bowelMovements: 0 },
      now + 1000,
    ),
  );
  assert.equal(twice.logs.length, db.logs.length + 4);
  assert.throws(() => buildDailyCheckIn(draft, now), /at least one section/);
});

test("invalid combined check-ins cannot partially change existing records", () => {
  const db = demoDatabase(now);
  const original = JSON.stringify(db);
  for (const invalid of [
    { ...draft, appetite: "Unsupported" },
    { ...draft, appetite: "Usual amount", urine: "No urine", wetDiapers: 1 },
    {
      ...draft,
      fluids: "Usual amount",
      bowelMovements: 0,
      stoolConsistency: "Watery",
    },
    { ...draft, wetDiapers: 1 },
    { ...draft, stoolDiapers: 1 },
    { ...draft, bowelMovements: -1 },
    { ...draft, bowelMovements: 0.5 },
    { ...draft, fluids: "Usual amount", period: "other" as const, notes: "" },
    { ...draft, appetite: "Usual amount", timeGiven: now + 3600000 },
  ])
    assert.throws(() => buildDailyCheckIn(invalid, now));
  assert.throws(() =>
    addDailyCheckIn(
      db,
      buildDailyCheckIn(
        { ...draft, childId: "missing", appetite: "Usual amount" },
        now,
      ),
    ),
  );
  assert.equal(JSON.stringify(db), original);
});

test("every common symptom has supported optional details that survive backups and reports", () => {
  const db = demoDatabase(now);
  db.logs = SYMPTOM_PRESETS.filter((s) => s.name !== "Other symptom").map(
    (s): Log => {
      const config = symptomObservation(s.name);
      assert.ok(config.fields.length);
      return {
        id: s.name,
        childId: "demo-ella",
        type: "SYMPTOM",
        timeGiven: now,
        timestamp: now,
        data: {
          symptomName: s.name,
          severity: "Moderate",
          notes: "Parent’s observation",
          symptomDetails: Object.fromEntries(
            config.fields.map((f) => [f.key, f.options?.[0] || "Left knee"]),
          ),
          ...(config.countLabel ? { symptomCount: 2 } : {}),
        },
      };
    },
  );
  const next = parseDatabase(JSON.parse(JSON.stringify(db)));
  assert.deepEqual(JSON.parse(JSON.stringify(next.logs)), db.logs);
  const report = makeReport("Ella", next.logs, db.settings, "", "");
  assert.match(report, /Vomiting episodes: 2/);
  assert.match(report, /Which ear: Left/);
  assert.match(report, /Cough sound: Dry/);
  assert.ok(filterLogs(next.logs, { search: "left knee" }).length > 0);
});

test("unsupported symptom details and unscoped counts reject imports while legacy severity stays intact", () => {
  const db = demoDatabase(now);
  const log: Log = {
    id: "v",
    childId: "demo-ella",
    type: "SYMPTOM",
    timeGiven: now,
    timestamp: now,
    data: { symptomName: "Vomiting", severity: "Moderate" },
  };
  db.logs = [log];
  assert.equal(parseDatabase(db).logs[0].data.severity, "Moderate");
  for (const data of [
    { ...log.data, symptomCount: 2 },
    {
      ...log.data,
      symptomCount: -1,
      symptomDetails: { period: "Today so far" },
    },
    { ...log.data, symptomDetails: { period: "Unknown" } },
    { ...log.data, symptomDetails: { amount: "Made up" } },
    { ...log.data, symptomDetails: { side: "Left" } },
    { ...log.data, symptomDetails: { amount: 3 } },
    {
      ...log.data,
      notes: "",
      symptomDetails: { period: "Another period (describe in notes)" },
    },
    { symptomName: "Cough", symptomCount: 2, symptomDetails: { sound: "Dry" } },
  ])
    assert.throws(() => parseDatabase({ ...db, logs: [{ ...log, data }] }));
  assert.throws(() =>
    parseDatabase({
      ...db,
      logs: [
        {
          ...log,
          type: "MEDICINE",
          data: {
            medicineName: "A",
            symptomDetails: { amount: "A small amount" },
          },
        },
      ],
    }),
  );
});

test("shared care preserves structured symptoms and deduplicates differently ordered detail keys", () => {
  const db = demoDatabase(now);
  db.logs = [
    {
      id: "v",
      childId: "demo-ella",
      type: "SYMPTOM",
      timeGiven: now,
      timestamp: now,
      data: {
        symptomName: "Vomiting",
        symptomCount: 2,
        symptomDetails: { period: "Today so far", fluids: "Some" },
      },
    },
  ];
  const file = careFileText(
    makeCareShare(db, "demo-ella", "", ""),
    db.settings,
    "https://example.com/",
  );
  const shared = readCareFile(file);
  assert.match(logDetail(shared.logs[0]), /Keeping fluids down: Some/);
  shared.logs[0].data.symptomDetails = {
    fluids: "Some",
    period: "Today so far",
  };
  assert.equal(mergeCareShare(db, shared, "demo-ella", {}).logs.length, 1);
});
