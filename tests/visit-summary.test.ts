import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVisitSummary,
  dayRanges,
  findOnset,
  visitSummaryText,
} from "../lib/visit-summary";
import { buildDailyCheckIn } from "../lib/daily-checkin";
import { emptyDatabase, logDetail, logTitle, parseDatabase } from "../lib/care";
import type { Log } from "../lib/types";

// Thursday evening, local time. Synthetic records only.
const now = new Date("2026-11-26T19:40:00").getTime();
const at = (day: number, hour: number) =>
  new Date(`2026-11-${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
let n = 0;
const log = (type: Log["type"], timeGiven: number, data: Log["data"]): Log => ({
  id: `log-${n++}`,
  childId: "kid",
  type,
  timeGiven,
  timestamp: timeGiven,
  data,
});
const settings = { timeFormat: "12h" as const, tempUnit: "F" as const };

const illness: Log[] = [
  log("METRIC", at(23, 18), { metricType: "illness", value: "Started" }),
  log("SYMPTOM", at(23, 19), {
    symptomName: "Fever",
    temp: "101.4",
    tempUnit: "F",
  }),
  log("SYMPTOM", at(24, 9), {
    symptomName: "Fever",
    temp: "39.3",
    tempUnit: "C",
  }),
  log("SYMPTOM", at(25, 18), {
    symptomName: "Fever",
    temp: "100.9",
    tempUnit: "F",
  }),
  log("SYMPTOM", at(24, 8), { symptomName: "Vomiting" }),
  log("SYMPTOM", at(24, 21), { symptomName: "Cough", severity: "Mild" }),
  log("SYMPTOM", at(25, 21), { symptomName: "cough" }),
  log("SYMPTOM", at(26, 8), { symptomName: "Runny nose" }),
  log("METRIC", at(24, 16), {
    metricType: "fluids",
    value: "Less than usual",
    observationPeriod: "today",
  }),
  log("METRIC", at(25, 16), {
    metricType: "fluids",
    value: "Usual amount",
    observationPeriod: "today",
  }),
  log("METRIC", at(26, 16), {
    metricType: "fluids",
    value: "Usual amount",
    observationPeriod: "today",
  }),
  log("METRIC", at(24, 17), {
    metricType: "urine",
    value: "Less than usual",
    wetDiapers: 2,
    observationPeriod: "today",
  }),
  log("METRIC", at(24, 12), {
    metricType: "urine",
    value: "Usual amount",
    observationPeriod: "today",
  }),
  log("METRIC", at(24, 20), { metricType: "not-seen", value: "Diarrhea" }),
  log("METRIC", at(25, 20), { metricType: "not-seen", value: "Diarrhea" }),
  log("METRIC", at(26, 18), { metricType: "not-seen", value: "Fever" }),
  log("MEDICINE", at(23, 20), {
    medicineName: "Acetaminophen",
    response: "a-little",
  }),
  log("MEDICINE", at(24, 10), {
    medicineName: "Ibuprofen",
    response: "helped",
  }),
  log("MEDICINE", at(25, 10), {
    medicineName: "ibuprofen ",
    response: "helped",
  }),
  log("MEDICINE", at(25, 20), { medicineName: "Honey" }),
];

test("day ranges collapse consecutive days and name recent weekdays", () => {
  assert.equal(
    dayRanges(["2026-11-25", "2026-11-23", "2026-11-24", "2026-11-26"], now),
    "Mon – today",
  );
  assert.equal(dayRanges(["2026-11-23", "2026-11-25"], now), "Mon, Wed");
  assert.equal(dayRanges(["2026-11-10"], now), "Nov 10");
});

test("summary restates recorded observations by day without interpreting them", () => {
  const s = buildVisitSummary(illness, illness, settings, now);
  assert.equal(s.onset?.label, "Sick since Mon, Nov 23 · day 4");
  const row = (key: string) => s.rows.find((r) => r.key === key)!;
  assert.deepEqual(row("Fever"), {
    key: "Fever",
    label: "Fever",
    status: "noticed",
    primary: "Mon – Wed",
    secondary:
      "Highest 102.7°F Tue · last noted Wed 6:00 PM · checked, not seen today",
  });
  assert.equal(row("fluids").primary, "Less than usual Tue");
  assert.equal(row("fluids").secondary, "Usual Wed – today");
  // A day's least-reassuring observation wins; diaper counts stay attached.
  assert.equal(row("urine").primary, "Less than usual (2 wet diapers) Tue");
  assert.equal(row("appetite").status, "not-recorded");
  assert.equal(row("Cough").primary, "Tue – Wed");
  assert.equal(row("Cough").secondary, "Mild");
  assert.equal(row("Vomiting").primary, "Tue");
  assert.deepEqual(row("Diarrhea"), {
    key: "Diarrhea",
    label: "Diarrhea",
    status: "none",
    primary: "None",
    secondary: "Checked Tue – Wed",
  });
  assert.equal(row("Rash").status, "not-recorded");
  assert.deepEqual(s.others, ["Runny nose today"]);
  assert.deepEqual(
    s.tried.map((t) => [t.name, t.days, t.response]),
    [
      ["Acetaminophen", "Mon", "Helped a little"],
      ["ibuprofen", "Tue – Wed", "Helped"],
      ["Honey", "Wed", "Not answered"],
    ],
  );
  const text = visitSummaryText(
    {
      id: "kid",
      name: "Ella",
      color: "sage",
      birthday: "2022-03-14",
      visitQuestions: "Daycare Monday?",
    },
    s,
    now,
  );
  assert.match(text, /SICK-VISIT SUMMARY — Ella, 4 years/);
  assert.match(text, /Diarrhea: None \(Checked Tue – Wed\)/);
  assert.match(text, /Our questions:\nDaycare Monday\?/);
  assert.doesNotMatch(text, /dose|mg|mL/i);
});

test("an illness ends at the first 'feeling better' after it started", () => {
  const logs = [
    ...illness,
    log("METRIC", at(26, 9), {
      metricType: "illness",
      value: "Feeling better",
    }),
  ];
  assert.equal(
    findOnset(logs, now, now)?.label,
    "Sick Mon, Nov 23 – Thu, Nov 26 · 4 days",
  );
  assert.equal(findOnset(logs, at(22, 12), now), null);
});

test("responses, illness markers and not-seen checks validate and display", () => {
  const db = emptyDatabase();
  const childId = db.children[0].id;
  const valid = parseDatabase({
    ...db,
    children: [{ ...db.children[0], visitQuestions: "Is this normal?" }],
    logs: [
      { ...illness[0], childId },
      { ...illness[13], childId },
      { ...illness[16], childId },
    ],
  });
  assert.equal(valid.children[0].visitQuestions, "Is this normal?");
  assert.equal(logTitle(valid.logs[0]), "Got sick");
  assert.equal(logTitle(valid.logs[1]), "No diarrhea");
  assert.equal(logDetail(valid.logs[2]), "Helped a little");
  for (const bad of [
    { ...illness[16], childId, data: { medicineName: "X", response: "great" } },
    {
      ...illness[4],
      childId,
      data: { symptomName: "Cough", response: "helped" },
    },
    { ...illness[0], childId, data: { metricType: "illness", value: "Maybe" } },
    {
      ...illness[13],
      childId,
      data: { metricType: "not-seen", value: "Earache" },
    },
  ])
    assert.throws(() => parseDatabase({ ...db, logs: [bad] }));
});

test("daily check-in saves not-seen checks with the same time", () => {
  const records = buildDailyCheckIn(
    {
      childId: "kid",
      timeGiven: now - 60000,
      period: "today",
      notes: "",
      appetite: "Usual amount",
      fluids: "",
      urine: "",
      notSeen: ["Vomiting", "Rash", "Rash"],
    },
    now,
  );
  assert.deepEqual(
    records.map((r) => [r.data.metricType, r.data.value, r.timeGiven]),
    [
      ["appetite", "Usual amount", now - 60000],
      ["not-seen", "Vomiting", now - 60000],
      ["not-seen", "Rash", now - 60000],
    ],
  );
  assert.throws(() =>
    buildDailyCheckIn(
      {
        childId: "kid",
        timeGiven: now,
        period: "today",
        notes: "",
        appetite: "",
        fluids: "",
        urine: "",
        notSeen: ["Earache"],
      },
      now,
    ),
  );
});

test("older free-text intake wording is read without flagging 'Normal'", () => {
  const s = buildVisitSummary(
    [
      log("METRIC", at(25, 9), { metricType: "fluids", value: "Normal" }),
      log("METRIC", at(26, 9), { metricType: "fluids", value: "Usual amount" }),
      log("METRIC", at(26, 12), {
        metricType: "fluids",
        value: "Less than normal",
      }),
    ],
    [],
    settings,
    now,
  );
  const fluids = s.rows.find((r) => r.key === "fluids")!;
  assert.equal(fluids.primary, "Less than normal today");
  assert.equal(fluids.secondary, "Usual Wed");
});
