import type { Database, Log, Unit } from "./types";

export const STORAGE_KEY = "kiddymeds_db_v2";
export const LEGACY_KEY = "kiddymeds_db_v1";
export const COLORS = ["sage", "peach", "mint", "blue", "rose", "lavender"];
export const MEDICINES = [
  { name: "Tylenol", detail: "Acetaminophen", color: "sage" },
  { name: "Motrin", detail: "Ibuprofen", color: "peach" },
  { name: "Albuterol", detail: "Your prescribed medicine", color: "blue" },
  { name: "Zyrtec", detail: "Cetirizine", color: "mint" },
  { name: "Zofran", detail: "Your prescribed medicine", color: "rose" },
  { name: "Pedialyte", detail: "Hydration", color: "blue" },
  { name: "Simethicone", detail: "Your care routine", color: "peach" },
];
export const SYMPTOMS = [
  "Fever",
  "Cough",
  "Vomiting",
  "Diarrhea",
  "Rash",
  "Other symptom",
];
export const URINE_OPTIONS = [
  "More than usual",
  "Usual amount",
  "Less than usual",
  "Much less, but still peeing",
  "No urine",
];
// Original, plain-language observations; not a numbered clinical stool scale.
export const STOOL_OPTIONS = [
  "Hard pellets",
  "Firm or lumpy",
  "Soft and formed",
  "Loose pieces",
  "Mushy",
  "Watery",
];
export const OBSERVATION_PERIODS = [
  { value: "today", label: "Today so far" },
  { value: "since-last", label: "Since the previous check-in" },
  { value: "other", label: "Another period (describe in notes)" },
] as const;
export const METRICS = [
  {
    key: "appetite",
    name: "Appetite",
    question: "How are meals going?",
    options: ["Normal", "Less than normal", "None"],
  },
  {
    key: "fluids",
    name: "Fluids",
    question: "Keeping hydrated?",
    options: ["Normal", "Less than normal", "Only a little", "None"],
  },
  {
    key: "urine",
    name: "Urine",
    question: "How does peeing compare with usual?",
    options: URINE_OPTIONS,
  },
  {
    key: "stool",
    name: "Stool",
    question: "What was their stool like?",
    options: STOOL_OPTIONS,
  },
];

/** Shared validation for forms and imported/stored records. Legacy value-only records remain valid. */
export function validateBathroomData(data: Log["data"]) {
  const counts = ["wetDiapers", "bowelMovements", "stoolDiapers"] as const;
  for (const key of counts) {
    const count = data[key];
    if (
      count !== undefined &&
      (!Number.isInteger(count) || count < 0 || count > 999)
    )
      throw new Error("Counts must be whole numbers from 0 to 999.");
  }
  if (
    data.observationPeriod !== undefined &&
    !OBSERVATION_PERIODS.some((p) => p.value === data.observationPeriod)
  )
    throw new Error("Choose a supported observation period.");
  if (
    data.stoolConsistency !== undefined &&
    !STOOL_OPTIONS.includes(data.stoolConsistency)
  )
    throw new Error("Choose a supported stool description.");
  if (
    (data.wetDiapers !== undefined && data.metricType !== "urine") ||
    ((data.bowelMovements !== undefined ||
      data.stoolDiapers !== undefined ||
      data.stoolConsistency !== undefined) &&
      data.metricType !== "stool") ||
    (data.observationPeriod !== undefined &&
      !["urine", "stool"].includes(data.metricType || ""))
  )
    throw new Error("Bathroom details belong to a urine or stool check-in.");
  if (
    data.metricType === "urine" &&
    data.value === "No urine" &&
    (data.wetDiapers || 0) > 0
  )
    throw new Error(
      "A check-in with no urine cannot include wet diapers for the same period.",
    );
  if (
    data.metricType === "stool" &&
    (data.bowelMovements === undefined ||
      data.value !==
        `${data.bowelMovements} bowel movement${data.bowelMovements === 1 ? "" : "s"}`)
  )
    throw new Error("A stool check-in needs a matching bowel-movement count.");
  if (
    data.bowelMovements === 0 &&
    (data.stoolConsistency !== undefined || (data.stoolDiapers || 0) > 0)
  )
    throw new Error(
      "A check-in with no bowel movements cannot include stool output for the same period.",
    );
  if (data.observationPeriod === "other" && !data.notes?.trim())
    throw new Error("Describe the period covered in notes.");
}

export function emptyDatabase(): Database {
  return {
    version: 2,
    children: [{ id: crypto.randomUUID(), name: "Your child", color: "sage" }],
    customMedicines: [],
    logs: [],
    settings: { timeFormat: "12h", tempUnit: "F" },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function str(value: unknown, max = 1000): value is string {
  return typeof value === "string" && value.length <= max;
}

/** Strictly validate before restoring. Older v1 backups retain IDs, times, and temperature units. */
export function parseDatabase(value: unknown): Database {
  if (
    !record(value) ||
    (value.version !== undefined && value.version !== 2) ||
    !Array.isArray(value.children) ||
    !Array.isArray(value.logs)
  )
    throw new Error("This isn’t a supported KiddyMeds backup.");
  if (
    value.children.length < 1 ||
    value.children.length > 100 ||
    value.logs.length > 100000
  )
    throw new Error(
      "The backup must contain at least one child and a supported number of records.",
    );
  const settings = record(value.settings) ? value.settings : {};
  const unit: Unit = settings.tempUnit === "C" ? "C" : "F";
  const ids = new Set<string>();
  const children = value.children.map((child, i) => {
    if (
      !record(child) ||
      !str(child.id, 100) ||
      !child.id ||
      ids.has(child.id) ||
      !str(child.name, 100) ||
      !child.name.trim()
    )
      throw new Error("The backup contains an invalid child profile.");
    ids.add(child.id);
    if (
      child.birthday !== undefined &&
      (!str(child.birthday, 10) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(child.birthday) ||
        !Number.isFinite(Date.parse(child.birthday)) ||
        localDate(new Date(`${child.birthday}T12:00:00`).getTime()) !==
          child.birthday)
    )
      throw new Error("A child’s birthday is invalid.");
    return {
      id: child.id,
      name: child.name.trim(),
      color:
        str(child.color) && COLORS.includes(child.color)
          ? child.color
          : COLORS[i % COLORS.length],
      ...(child.birthday ? { birthday: child.birthday as string } : {}),
    };
  });
  const logIds = new Set<string>();
  const logs: Log[] = value.logs.map((log) => {
    if (
      !record(log) ||
      !str(log.id, 100) ||
      !log.id ||
      logIds.has(log.id) ||
      !str(log.childId, 100) ||
      !ids.has(log.childId) ||
      !["MEDICINE", "SYMPTOM", "METRIC"].includes(String(log.type)) ||
      typeof log.timeGiven !== "number" ||
      !Number.isFinite(log.timeGiven) ||
      !Number.isFinite(new Date(log.timeGiven).getTime()) ||
      !record(log.data)
    )
      throw new Error(
        "The backup contains invalid or unlinked care records. Nothing was replaced.",
      );
    logIds.add(log.id);
    const source = log.data;
    const data: Log["data"] = {};
    for (const key of [
      "medicineName",
      "dosage",
      "symptomName",
      "temp",
      "severity",
      "notes",
      "metricType",
      "value",
      "stoolConsistency",
    ] as const) {
      if (source[key] !== undefined) {
        if (!str(source[key], key === "notes" ? 5000 : 200))
          throw new Error("A record contains invalid text.");
        data[key] = source[key];
      }
    }
    if (
      source.frequencyHours !== undefined &&
      source.frequencyHours !== null &&
      (typeof source.frequencyHours !== "number" ||
        !Number.isFinite(source.frequencyHours) ||
        source.frequencyHours <= 0 ||
        source.frequencyHours > 8760)
    )
      throw new Error("A medicine interval is invalid.");
    data.frequencyHours = source.frequencyHours as number | null | undefined;
    for (const key of [
      "wetDiapers",
      "bowelMovements",
      "stoolDiapers",
    ] as const) {
      if (source[key] !== undefined) {
        if (typeof source[key] !== "number")
          throw new Error("A bathroom count is invalid.");
        data[key] = source[key];
      }
    }
    if (source.observationPeriod !== undefined) {
      if (
        !OBSERVATION_PERIODS.some((p) => p.value === source.observationPeriod)
      )
        throw new Error("A bathroom observation period is invalid.");
      data.observationPeriod =
        source.observationPeriod as Log["data"]["observationPeriod"];
    }
    validateBathroomData(data);
    if (
      log.type !== "METRIC" &&
      [
        "wetDiapers",
        "bowelMovements",
        "stoolDiapers",
        "stoolConsistency",
        "observationPeriod",
      ].some((k) => source[k] !== undefined)
    )
      throw new Error("Bathroom details belong to a daily check-in.");
    if (
      (log.type === "MEDICINE" && !data.medicineName?.trim()) ||
      (log.type === "SYMPTOM" && !data.symptomName?.trim()) ||
      (log.type === "METRIC" &&
        (!data.metricType?.trim() || !data.value?.trim()))
    )
      throw new Error("A care record is missing its name or value.");
    if (data.temp) {
      if (
        !Number.isFinite(Number(data.temp)) ||
        (source.tempUnit !== undefined &&
          source.tempUnit !== "F" &&
          source.tempUnit !== "C")
      )
        throw new Error("A temperature record is invalid.");
      data.tempUnit = (source.tempUnit as Unit) || unit;
    }
    return {
      id: log.id,
      childId: log.childId,
      type: log.type as Log["type"],
      timeGiven: log.timeGiven,
      timestamp:
        typeof log.timestamp === "number" && Number.isFinite(log.timestamp)
          ? log.timestamp
          : log.timeGiven,
      data,
    };
  });
  if (
    value.customMedicines !== undefined &&
    (!Array.isArray(value.customMedicines) ||
      !value.customMedicines.every((m) => str(m, 100) && m.trim()))
  )
    throw new Error("Medicine shortcuts in this backup are invalid.");
  return {
    version: 2,
    children,
    logs,
    customMedicines: Array.from(
      new Set(((value.customMedicines as string[]) || []).map((m) => m.trim())),
    ),
    settings: {
      timeFormat: settings.timeFormat === "24h" ? "24h" : "12h",
      tempUnit: unit,
      activeChildId:
        str(settings.activeChildId) && ids.has(settings.activeChildId)
          ? settings.activeChildId
          : children[0].id,
    },
  };
}

export function childLogs(db: Database, childId: string): Log[] {
  return db.logs
    .filter((l) => l.childId === childId)
    .sort((a, b) => b.timeGiven - a.timeGiven || b.timestamp - a.timestamp);
}
export function todayLogs(logs: Log[], now: number) {
  return logs.filter((l) => localDate(l.timeGiven) === localDate(now));
}
export function localDate(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localInput(time = Date.now()) {
  const d = new Date(time);
  return new Date(time - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function formatTime(time: number, format: "12h" | "24h" = "12h") {
  return new Date(time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  });
}
export function duration(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(minutes / 60);
  return h ? `${h}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
}
export function relativeTime(time: number, now: number) {
  const diff = now - time;
  return diff < 60000
    ? "Just now"
    : diff < 86400000
      ? `${duration(diff)} ago`
      : new Date(time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
}
export function logTitle(log: Log) {
  if (
    log.type === "METRIC" &&
    log.data.metricType === "urine" &&
    !log.data.observationPeriod
  )
    return "Bathroom (previous check-in)";
  return log.type === "MEDICINE"
    ? log.data.medicineName || "Medicine"
    : log.type === "SYMPTOM"
      ? log.data.symptomName || "Symptom"
      : METRICS.find((m) => m.key === log.data.metricType)?.name ||
        log.data.metricType ||
        "Daily check-in";
}
export function convertTemperature(value: string, from: Unit, to: Unit) {
  return (
    from === to
      ? Number(value)
      : to === "C"
        ? ((Number(value) - 32) * 5) / 9
        : (Number(value) * 9) / 5 + 32
  ).toFixed(1);
}
export function logDetail(log: Log, unit: Unit = "F") {
  const d = log.data;
  if (log.type === "MEDICINE")
    return (
      [
        d.dosage,
        d.frequencyHours && `${d.frequencyHours}h recorded interval`,
        d.notes,
      ]
        .filter(Boolean)
        .join(" · ") || "Dose recorded"
    );
  if (log.type === "SYMPTOM")
    return (
      [
        d.temp &&
          `${convertTemperature(d.temp, d.tempUnit || unit, unit)}°${unit}`,
        d.severity,
        d.notes,
      ]
        .filter(Boolean)
        .join(" · ") || "Symptom recorded"
    );
  return [
    d.value,
    d.wetDiapers !== undefined &&
      `${d.wetDiapers} wet diaper${d.wetDiapers === 1 ? "" : "s"}`,
    d.stoolDiapers !== undefined &&
      `${d.stoolDiapers} stool diaper${d.stoolDiapers === 1 ? "" : "s"}`,
    d.stoolConsistency,
    OBSERVATION_PERIODS.find((p) => p.value === d.observationPeriod)?.label,
    d.notes,
  ]
    .filter((v) => v !== undefined && v !== false && v !== "")
    .join(" · ");
}
/** One clock per medicine; latest entry wins even if it removes a previous interval. */
export function medicineTimers(logs: Log[], now: number) {
  const latest = new Map<string, Log>();
  for (const log of [...logs].sort(
    (a, b) => b.timeGiven - a.timeGiven || b.timestamp - a.timestamp,
  )) {
    if (
      log.type === "MEDICINE" &&
      !latest.has(log.data.medicineName!.trim().toLocaleLowerCase())
    )
      latest.set(log.data.medicineName!.trim().toLocaleLowerCase(), log);
  }
  return [...latest.values()]
    .filter((l) => l.data.frequencyHours)
    .map((log) => {
      const target = log.timeGiven + log.data.frequencyHours! * 3600000;
      return {
        log,
        target,
        remaining: target - now,
        elapsed: now - log.timeGiven,
      };
    })
    .sort((a, b) => a.target - b.target);
}
export function filterLogs(
  logs: Log[],
  {
    search = "",
    type = "all",
    from = "",
    to = "",
  }: { search?: string; type?: string; from?: string; to?: string },
) {
  const needle = search.toLocaleLowerCase();
  return logs.filter(
    (l) =>
      (type === "all" || l.type === type) &&
      (!from || localDate(l.timeGiven) >= from) &&
      (!to || localDate(l.timeGiven) <= to) &&
      (!needle ||
        `${logTitle(l)} ${logDetail(l)} ${l.data.notes || ""}`
          .toLocaleLowerCase()
          .includes(needle)),
  );
}
export function makeReport(
  child: string,
  logs: Log[],
  settings: Database["settings"],
  from: string,
  to: string,
) {
  let text = `KiddyMeds — Care report for ${child}\nPeriod: ${from || "Beginning"} to ${to || "Today"}\n${logs.length} recorded entries\n\n`;
  let day = "";
  for (const log of [...logs].sort(
    (a, b) => a.timeGiven - b.timeGiven || a.timestamp - b.timestamp,
  )) {
    const date = new Date(log.timeGiven).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (date !== day) {
      text += `${date}\n${"─".repeat(38)}\n`;
      day = date;
    }
    text += `${formatTime(log.timeGiven, settings.timeFormat)} · ${logTitle(log)}\n  ${logDetail(log, settings.tempUnit)}\n\n`;
  }
  return (
    text +
    (logs.length ? "" : "No entries in this period.\n\n") +
    "Parent-recorded observations. This report is a care record, not medical advice. Follow your healthcare provider’s instructions."
  );
}
export function demoDatabase(now: number): Database {
  const db = emptyDatabase();
  db.children = [
    { id: "demo-ella", name: "Ella", birthday: "2022-03-14", color: "sage" },
    {
      id: "demo-oliver",
      name: "Oliver",
      birthday: "2020-08-03",
      color: "peach",
    },
  ];
  db.settings.activeChildId = "demo-ella";
  const sample: Omit<Log, "id" | "timestamp" | "childId">[] = [
    {
      type: "MEDICINE",
      timeGiven: now - 90 * 60000,
      data: {
        medicineName: "Tylenol",
        dosage: "As directed by our doctor",
        frequencyHours: 6,
        notes: "Resting after breakfast",
      },
    },
    {
      type: "SYMPTOM",
      timeGiven: now - 2 * 3600000,
      data: {
        symptomName: "Fever",
        temp: "100.2",
        tempUnit: "F",
        notes: "A little tired, but in good spirits",
      },
    },
    {
      type: "METRIC",
      timeGiven: now - 3 * 3600000,
      data: { metricType: "fluids", value: "Normal" },
    },
    {
      type: "METRIC",
      timeGiven: now - 3 * 3600000,
      data: { metricType: "appetite", value: "Less than normal" },
    },
    {
      type: "METRIC",
      timeGiven: now - 2 * 3600000,
      data: {
        metricType: "urine",
        value: "Usual amount",
        observationPeriod: "today",
      },
    },
    {
      type: "METRIC",
      timeGiven: now - 2 * 3600000,
      data: {
        metricType: "stool",
        value: "1 bowel movement",
        bowelMovements: 1,
        stoolConsistency: "Soft and formed",
        observationPeriod: "today",
      },
    },
    {
      type: "SYMPTOM",
      timeGiven: now - 5 * 3600000,
      data: {
        symptomName: "Cough",
        severity: "Mild",
        notes: "Mostly in the morning",
      },
    },
    {
      type: "SYMPTOM",
      timeGiven: now - 26 * 3600000,
      data: { symptomName: "Fever", temp: "101.1", tempUnit: "F" },
    },
  ];
  db.logs = sample.map((l, i) => ({
    ...l,
    id: `demo-log-${i}`,
    timestamp: l.timeGiven,
    childId: "demo-ella",
  }));
  return db;
}
