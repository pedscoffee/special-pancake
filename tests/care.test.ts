import { test } from "node:test";
import assert from "node:assert/strict";
import {
  childLogs,
  convertTemperature,
  filterLogs,
  localDate,
  logDetail,
  logTitle,
  makeReport,
  medicineTimers,
  parseDatabase,
  demoDatabase,
} from "../lib/care";
import type { Database, Log } from "../lib/types";

const now = new Date("2026-10-02T12:00:00").getTime();
function medicine(
  id: string,
  name: string,
  hoursAgo: number,
  frequencyHours: number | null = 6,
): Log {
  return {
    id,
    childId: "ella",
    type: "MEDICINE",
    timeGiven: now - hoursAgo * 3600000,
    timestamp: now,
    data: { medicineName: name, dosage: "Recorded dose", frequencyHours },
  };
}
function database(): Database {
  return {
    version: 2,
    children: [
      { id: "ella", name: "Ella", color: "lavender" },
      { id: "oli", name: "Oliver", color: "peach" },
    ],
    logs: [],
    customMedicines: [],
    settings: { timeFormat: "12h", tempUnit: "F" },
  };
}

test("v1 migration preserves IDs, recorded times, shortcuts, and source temperature unit", () => {
  const legacy = {
    children: [{ id: "ella", name: "Ella", color: "var(--col-teal)" }],
    customMedicines: ["Custom medicine"],
    settings: { tempUnit: "C", timeFormat: "24h" },
    logs: [
      {
        id: "fever",
        childId: "ella",
        type: "SYMPTOM",
        timeGiven: now,
        data: { symptomName: "Fever", temp: "38.0" },
      },
    ],
  };
  const db = parseDatabase(legacy);
  assert.equal(db.version, 2);
  assert.equal(db.children[0].id, "ella");
  assert.equal(db.logs[0].timeGiven, now);
  assert.equal(db.logs[0].data.tempUnit, "C");
  assert.equal(db.settings.timeFormat, "24h");
  assert.deepEqual(db.customMedicines, ["Custom medicine"]);
  assert.equal(
    convertTemperature(db.logs[0].data.temp!, db.logs[0].data.tempUnit!, "F"),
    "100.4",
  );
});

test("bathroom observations survive backups, search and reports without combining counts", () => {
  const db = database();
  db.logs = [
    {
      ...medicine("urine", "A", 1),
      type: "METRIC",
      data: {
        metricType: "urine",
        value: "Much less, but still peeing",
        observationPeriod: "today",
        wetDiapers: 2,
      },
    },
    {
      ...medicine("stool", "A", 2),
      type: "METRIC",
      data: {
        metricType: "stool",
        value: "2 bowel movements",
        observationPeriod: "since-last",
        bowelMovements: 2,
        stoolDiapers: 1,
        stoolConsistency: "Mushy",
        notes: "Mixed diaper at lunch",
      },
    },
    {
      ...medicine("zero", "A", 3),
      type: "METRIC",
      data: {
        metricType: "stool",
        value: "0 bowel movements",
        observationPeriod: "today",
        bowelMovements: 0,
        stoolDiapers: 0,
      },
    },
  ];
  const restored = parseDatabase(JSON.parse(JSON.stringify(db)));
  assert.deepEqual(JSON.parse(JSON.stringify(restored.logs)), db.logs);
  assert.equal(logTitle(restored.logs[0]), "Urine");
  assert.equal(logTitle(restored.logs[1]), "Stool");
  assert.match(logDetail(restored.logs[0]), /2 wet diapers/);
  assert.match(
    logDetail(restored.logs[1]),
    /2 bowel movements · 1 stool diaper · Mushy/,
  );
  assert.match(
    logDetail(restored.logs[2]),
    /0 bowel movements · 0 stool diapers/,
  );
  assert.deepEqual(
    filterLogs(restored.logs, { search: "mushy" }).map((l) => l.id),
    ["stool"],
  );
  const report = makeReport("Ella", restored.logs, db.settings, "", "");
  assert.match(
    report,
    /Much less, but still peeing · 2 wet diapers · Today so far/,
  );
  assert.match(report, /Since the previous check-in/);
  assert.match(report, /Mixed diaper at lunch/);
  assert.doesNotMatch(report, /3 diapers/);
});

test("legacy bathroom values remain intact and missing counts remain distinct from zero", () => {
  const db = database();
  db.logs = [
    {
      ...medicine("old", "A", 1),
      type: "METRIC",
      data: {
        metricType: "urine",
        value: "4 times",
        notes: "Previously recorded",
      },
    },
    {
      ...medicine("blank", "A", 2),
      type: "METRIC",
      data: {
        metricType: "urine",
        value: "Usual amount",
        observationPeriod: "today",
      },
    },
    {
      ...medicine("zero", "A", 3),
      type: "METRIC",
      data: {
        metricType: "urine",
        value: "No urine",
        observationPeriod: "today",
        wetDiapers: 0,
      },
    },
  ];
  const restored = parseDatabase(db);
  assert.equal(logTitle(restored.logs[0]), "Bathroom (previous check-in)");
  assert.equal(restored.logs[0].data.value, "4 times");
  assert.equal(restored.logs[0].data.observationPeriod, undefined);
  assert.equal(restored.logs[1].data.wetDiapers, undefined);
  assert.doesNotMatch(logDetail(restored.logs[1]), /diaper/);
  assert.match(logDetail(restored.logs[2]), /0 wet diapers/);
});

test("invalid bathroom counts and conflicting output are rejected before restore", () => {
  const base = {
    metricType: "stool",
    value: "1 bowel movement",
    bowelMovements: 1,
    observationPeriod: "today",
  };
  const invalid = [
    ...[-1, 0.5, 1000, Infinity, "2", null].map((stoolDiapers) => ({
      ...base,
      stoolDiapers,
    })),
    { ...base, stoolConsistency: "not a supported description" },
    { ...base, observationPeriod: "yesterday" },
    { ...base, observationPeriod: "other", notes: " " },
    { ...base, value: "3 bowel movements" },
    { ...base, bowelMovements: undefined },
    { ...base, wetDiapers: 1 },
    { ...base, value: "0 bowel movements", bowelMovements: 0, stoolDiapers: 1 },
    {
      ...base,
      value: "0 bowel movements",
      bowelMovements: 0,
      stoolConsistency: "Watery",
    },
    { metricType: "urine", value: "No urine", wetDiapers: 1 },
    { metricType: "fluids", value: "Normal", wetDiapers: 1 },
  ];
  for (const data of invalid)
    assert.throws(() =>
      parseDatabase({
        ...database(),
        logs: [{ ...medicine("invalid", "A", 1), type: "METRIC", data }],
      }),
    );
  assert.doesNotThrow(() =>
    parseDatabase({
      ...database(),
      logs: [
        {
          ...medicine("other-period", "A", 1),
          type: "METRIC",
          data: {
            ...base,
            observationPeriod: "other",
            notes: "Since breakfast",
          },
        },
      ],
    }),
  );
  assert.doesNotThrow(() => parseDatabase(demoDatabase(now)));
});
test("malformed backups, duplicate IDs, and unknown schema versions are rejected", () => {
  for (const input of [
    null,
    {},
    { ...database(), version: 3 },
    { ...database(), children: [] },
    {
      ...database(),
      children: [database().children[0], database().children[0]],
    },
    {
      ...database(),
      logs: [medicine("same", "A", 1), medicine("same", "B", 2)],
    },
  ])
    assert.throws(() => parseDatabase(input));
});
test("unlinked logs and invalid dates cannot overwrite a database", () => {
  assert.throws(() =>
    parseDatabase({
      ...database(),
      logs: [{ ...medicine("x", "A", 1), childId: "missing" }],
    }),
  );
  for (const time of [NaN, Infinity, 1e30, "yesterday"])
    assert.throws(() =>
      parseDatabase({
        ...database(),
        logs: [{ ...medicine("x", "A", 1), timeGiven: time }],
      }),
    );
});
test("invalid temperatures, intervals, names and shortcuts are rejected", () => {
  for (const interval of [-1, 0, NaN, "6", 9000])
    assert.throws(() =>
      parseDatabase({
        ...database(),
        logs: [
          {
            ...medicine("x", "A", 1),
            data: { medicineName: "A", frequencyHours: interval },
          },
        ],
      }),
    );
  assert.throws(() =>
    parseDatabase({ ...database(), customMedicines: [null] }),
  );
  assert.throws(() =>
    parseDatabase({
      ...database(),
      children: [{ ...database().children[0], birthday: "2020-02-31" }],
    }),
  );
  assert.throws(() =>
    parseDatabase({
      ...database(),
      logs: [{ ...medicine("x", "A", 1), data: { medicineName: "" } }],
    }),
  );
  assert.throws(() =>
    parseDatabase({
      ...database(),
      logs: [
        {
          ...medicine("x", "A", 1),
          type: "SYMPTOM",
          data: { symptomName: "Fever", temp: "bad" },
        },
      ],
    }),
  );
});
test("round trip preserves every valid record and preference", () => {
  const db = database();
  db.logs = [medicine("1", "Tylenol", 1)];
  db.children[0].birthday = "2022-03-14";
  db.settings.activeChildId = "oli";
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(db))), db);
});
test("medicine clocks track each medicine independently and normalize name casing", () => {
  const clocks = medicineTimers(
    [
      medicine("old", "Tylenol", 9),
      medicine("new", "tylenol", 1),
      medicine("other", "Motrin", 3, 8),
    ],
    now,
  );
  assert.equal(clocks.length, 2);
  assert.equal(clocks.find((c) => c.log.id === "new")!.remaining, 5 * 3600000);
  assert.equal(
    clocks.find((c) => c.log.id === "other")!.remaining,
    5 * 3600000,
  );
  assert.ok(!clocks.some((c) => c.log.id === "old"));
});
test("a new dose without an interval clears a previous clock", () => {
  assert.equal(
    medicineTimers(
      [medicine("old", "Tylenol", 4), medicine("new", "Tylenol", 1, null)],
      now,
    ).length,
    0,
  );
});
test("records within the same minute use creation time to find the latest dose and check-in", () => {
  const older = { ...medicine("old", "Tylenol", 1), timestamp: now - 1000 };
  const newer = { ...medicine("new", "Tylenol", 1, 8), timestamp: now };
  const db = database();
  db.logs = [older, newer];
  assert.equal(childLogs(db, "ella")[0].id, "new");
  assert.equal(medicineTimers(db.logs, now)[0].log.id, "new");
  assert.equal(medicineTimers(db.logs, now)[0].remaining, 7 * 3600000);
});
test("passed intervals stay informational and expose elapsed time", () => {
  const clock = medicineTimers([medicine("1", "Tylenol", 8)], now)[0];
  assert.equal(clock.remaining, -2 * 3600000);
  assert.equal(clock.elapsed, 8 * 3600000);
});
test("child filtering and sorting do not mutate the shared care history", () => {
  const db = database();
  db.logs = [
    medicine("older", "A", 5),
    { ...medicine("other", "B", 1), childId: "oli" },
    medicine("newer", "A", 2),
  ];
  assert.deepEqual(
    childLogs(db, "ella").map((l) => l.id),
    ["newer", "older"],
  );
  assert.deepEqual(
    db.logs.map((l) => l.id),
    ["older", "other", "newer"],
  );
});
test("history combines full-day date ranges, text search and record type", () => {
  const logs = [
    medicine("today", "Tylenol", 1),
    medicine("yesterday", "Tylenol", 25),
    medicine("other", "Motrin", 2),
  ];
  assert.deepEqual(
    filterLogs(logs, {
      search: "TYLENOL",
      type: "MEDICINE",
      from: localDate(now),
      to: localDate(now),
    }).map((l) => l.id),
    ["today"],
  );
  assert.deepEqual(filterLogs(logs, { type: "SYMPTOM" }), []);
});
test("temperature conversion is reversible and keeps original precision", () => {
  assert.equal(convertTemperature("100.4", "F", "C"), "38.0");
  assert.equal(convertTemperature("38", "C", "F"), "100.4");
  assert.equal(convertTemperature("100.2", "F", "F"), "100.2");
});
test("reports include doses, temperature units, check-ins and notes in chronological order", () => {
  const logs: Log[] = [
    medicine("new", "Tylenol", 1),
    {
      ...medicine("old", "A", 2),
      type: "SYMPTOM",
      data: {
        symptomName: "Fever",
        temp: "38",
        tempUnit: "C",
        notes: "Resting well",
      },
    },
    {
      ...medicine("metric", "A", 3),
      type: "METRIC",
      data: {
        metricType: "fluids",
        value: "Normal",
        notes: "Water with breakfast",
      },
    },
  ];
  const report = makeReport(
    "Ella",
    logs,
    database().settings,
    "2026-10-01",
    "2026-10-02",
  );
  assert.ok(report.includes("100.4°F"));
  assert.ok(report.includes("Resting well"));
  assert.ok(report.includes("Recorded dose"));
  assert.ok(report.indexOf("Fluids") < report.indexOf("Fever"));
  assert.ok(report.indexOf("Fever") < report.indexOf("Tylenol"));
});
