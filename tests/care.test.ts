import { test } from "node:test";
import assert from "node:assert/strict";
import {
  childLogs,
  convertTemperature,
  filterLogs,
  localDate,
  makeReport,
  medicineTimers,
  parseDatabase,
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
