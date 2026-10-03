import {
  childLogs,
  filterLogs,
  formatTime,
  localDate,
  logDetail,
  logTitle,
  makeReport,
  parseDatabase,
} from "./care";
import type { Child, Database, Log } from "./types";

export const SHARE_MARKER = "\n--- KiddyMeds import data (v1) ---\n";
export type CareShare = {
  kind: "kiddymeds-care-share";
  version: 1;
  sharedAt: number;
  child: Child;
  from: string;
  to: string;
  logs: Log[];
};
export type ConflictChoice = {
  keep: "local" | "incoming";
  localSignature: string;
};
export type MergePlan = {
  added: Log[];
  duplicates: Log[];
  conflicts: { local: Log; incoming: Log }[];
};

export function makeCareShare(
  db: Database,
  childId: string,
  from: string,
  to: string,
  type = "all",
  now = Date.now(),
): CareShare {
  const child = db.children.find((c) => c.id === childId);
  if (!child) throw new Error("Choose a child to share.");
  const logs = filterLogs(childLogs(db, childId), { from, to, type }).map(
    (log) => ({
      ...log,
      data: {
        ...log.data,
        ...(log.data.temp
          ? { tempUnit: log.data.tempUnit || db.settings.tempUnit }
          : {}),
      },
    }),
  );
  return parseCareShare({
    kind: "kiddymeds-care-share",
    version: 1,
    sharedAt: now,
    child: { id: child.id, name: child.name, color: child.color },
    from,
    to,
    logs,
  });
}

function validDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        localDate(new Date(`${value}T12:00:00`).getTime()) === value))
  );
}

export function parseCareShare(input: unknown): CareShare {
  if (!input || typeof input !== "object")
    throw new Error("Choose a KiddyMeds care file shared from Reports.");
  const value = input as Record<string, unknown>;
  if (
    value.kind !== "kiddymeds-care-share" ||
    value.version !== 1 ||
    !validDay(value.from) ||
    !validDay(value.to) ||
    (value.from && value.to && value.from > value.to) ||
    typeof value.sharedAt !== "number" ||
    !Number.isFinite(new Date(value.sharedAt).getTime()) ||
    !Array.isArray(value.logs) ||
    !value.logs.length
  )
    throw new Error(
      "This isn’t a supported KiddyMeds care file. For a full backup, use Restore backup in Settings.",
    );
  const db = parseDatabase({
    version: 2,
    children: [value.child],
    logs: value.logs,
    customMedicines: [],
    settings: { tempUnit: "F", timeFormat: "12h" },
  });
  if (
    db.logs.some(
      (log, i) =>
        log.data.temp &&
        log.data.tempUnit !== (value.logs as Log[])[i].data.tempUnit,
    )
  )
    throw new Error("A shared temperature is missing its recorded unit.");
  return {
    kind: "kiddymeds-care-share",
    version: 1,
    sharedAt: value.sharedAt,
    child: db.children[0],
    from: value.from,
    to: value.to,
    logs: db.logs,
  };
}

export function readCareFile(text: string): CareShare {
  text = text.replace(/\r\n/g, "\n");
  const marker = text.lastIndexOf(SHARE_MARKER);
  try {
    return parseCareShare(
      JSON.parse(marker >= 0 ? text.slice(marker + SHARE_MARKER.length) : text),
    );
  } catch (err) {
    if (err instanceof SyntaxError)
      throw new Error(
        "This file couldn’t be read. Choose the care file attached by the sender.",
      );
    throw err;
  }
}

export function careShareMessage(
  share: CareShare,
  settings: Database["settings"],
  note = "",
) {
  const period = `${share.from || "Beginning"} to ${share.to || "Latest included record"}`;
  const count = (type: Log["type"]) =>
    share.logs.filter((l) => l.type === type).length;
  const counts = [
    `${count("MEDICINE")} medicine ${count("MEDICINE") === 1 ? "entry" : "entries"}`,
    `${count("SYMPTOM")} ${count("SYMPTOM") === 1 ? "observation" : "observations"}`,
    `${count("METRIC")} daily ${count("METRIC") === 1 ? "check-in" : "check-ins"}`,
  ].join(" · ");
  const lines = [...share.logs]
    .sort((a, b) => b.timeGiven - a.timeGiven || b.timestamp - a.timestamp)
    .slice(0, 6)
    .map((log) => {
      const detail = logDetail(log, settings.tempUnit).replace(/\s+/g, " ");
      return `${localDate(log.timeGiven)} ${formatTime(log.timeGiven, settings.timeFormat)} · ${logTitle(log)} — ${detail.length > 180 ? detail.slice(0, 177) + "…" : detail}`;
    });
  return [
    note.trim(),
    `${share.child.name}’s care update · KiddyMeds`,
    `Period: ${period}`,
    `Shared: ${new Date(share.sharedAt).toLocaleString("en-US")}`,
    counts,
    "",
    "Latest included records:",
    ...lines,
    ...(share.logs.length > 6
      ? [`…and ${share.logs.length - 6} more entries in the full care file.`]
      : []),
    "",
    "A snapshot of parent-recorded care. New changes won’t appear automatically.",
  ]
    .filter((line, i) => i !== 0 || line)
    .join("\n");
}

export function careFileText(
  share: CareShare,
  settings: Database["settings"],
  appUrl: string,
  note = "",
) {
  return (
    [
      note.trim(),
      makeReport(share.child.name, share.logs, settings, share.from, share.to),
      `Shared: ${new Date(share.sharedAt).toLocaleString("en-US")}`,
      "This is a snapshot; later changes are not synchronized.",
      `To add these records to KiddyMeds, open ${appUrl}reports/ and choose Receive care. Select this file and review the records before adding them.`,
    ]
      .filter(Boolean)
      .join("\n\n") +
    SHARE_MARKER +
    JSON.stringify(share)
  );
}

export function careFileName(share: CareShare) {
  const name =
    share.child.name
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "child";
  return `kiddymeds-${name}-care-${localDate(share.sharedAt)}.txt`;
}

export function recordSignature(log: Log) {
  return JSON.stringify({
    type: log.type,
    timeGiven: log.timeGiven,
    data: Object.fromEntries(
      Object.entries(log.data)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [
          key,
          key === "symptomDetails" && value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
              )
            : value,
        ]),
    ),
  });
}

export function planCareMerge(
  db: Database,
  share: CareShare,
  childId: string,
): MergePlan {
  const plan: MergePlan = { added: [], duplicates: [], conflicts: [] };
  const existing = new Map(db.logs.map((log) => [log.id, log]));
  for (const source of share.logs) {
    const incoming = { ...source, childId };
    const local = existing.get(incoming.id);
    if (!local) plan.added.push(incoming);
    else if (local.childId !== childId)
      throw new Error(
        "Some of these records already belong to another child. Choose that profile to receive this file.",
      );
    else if (recordSignature(local) === recordSignature(incoming))
      plan.duplicates.push(incoming);
    else plan.conflicts.push({ local, incoming });
  }
  return plan;
}

export function mergeCareShare(
  db: Database,
  share: CareShare,
  target: string | null,
  choices: Record<string, ConflictChoice>,
): Database {
  const newChild = target === null;
  if (
    newChild &&
    (db.children.some((c) => c.id === share.child.id) ||
      db.children.length >= 100)
  )
    throw new Error("Choose an existing child profile for these records.");
  const childId = newChild ? share.child.id : target!;
  if (!newChild && !db.children.some((c) => c.id === childId))
    throw new Error("Choose a child profile before adding records.");
  const plan = planCareMerge(db, share, childId);
  const replacements = new Map<string, Log>();
  for (const conflict of plan.conflicts) {
    const choice = choices[conflict.local.id];
    if (
      !choice ||
      !["local", "incoming"].includes(choice.keep) ||
      choice.localSignature !== recordSignature(conflict.local)
    )
      throw new Error(
        "Review each differing record before adding this care file. A record may have changed since your review.",
      );
    if (choice.keep === "incoming")
      replacements.set(conflict.local.id, conflict.incoming);
  }
  return parseDatabase({
    ...db,
    children: newChild ? [...db.children, share.child] : db.children,
    logs: [
      ...db.logs.map((log) => replacements.get(log.id) || log),
      ...plan.added,
    ],
    // Sharing never changes personal preferences or medicine shortcuts.
    settings: db.settings,
  });
}
