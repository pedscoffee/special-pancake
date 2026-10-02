"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Heart,
  Info,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  CirclePlay,
  Upload,
  X,
} from "lucide-react";
import type { Child, Database, Log } from "@/lib/types";
import {
  emptyDatabase,
  filterLogs,
  LEGACY_KEY,
  localDate,
  logDetail,
  logTitle,
  makeReport,
  parseDatabase,
  STORAGE_KEY,
} from "@/lib/care";
import { downloadFile } from "@/lib/download";
import { useCare } from "./care-provider";
import { EmptyState, EntryList, IconBox, Modal, SectionHeading } from "./ui";
import type { EntryAction } from "./care-app";

const FILTERS = [
  { value: "all", label: "Everything" },
  { value: "MEDICINE", label: "Medicines" },
  { value: "SYMPTOM", label: "Symptoms" },
  { value: "METRIC", label: "Check-ins" },
];

export function HistoryView({
  logs,
  edit,
  add,
}: {
  logs: Log[];
  edit: (log: Log) => void;
  add: EntryAction;
}) {
  const { db, now, notify } = useCare();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(50);
  const filtered = useMemo(
    () => filterLogs(logs, { search, type, from, to }),
    [logs, search, type, from, to],
  );
  const grouped = new Map<string, Log[]>();
  for (const log of filtered.slice(0, limit)) {
    const key = localDate(log.timeGiven);
    grouped.set(key, [...(grouped.get(key) || []), log]);
  }
  function csv() {
    const cell = (s: string) =>
      `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
    const rows = filtered.map((l) =>
      [
        new Date(l.timeGiven).toISOString(),
        l.type,
        logTitle(l),
        logDetail(l, db!.settings.tempUnit),
      ]
        .map(cell)
        .join(","),
    );
    downloadFile(
      ["Time,Type,Entry,Details", ...rows].join("\r\n"),
      `kiddymeds-history-${localDate(now)}.csv`,
      "text/csv;charset=utf-8",
    );
    notify("History exported.");
  }
  return (
    <>
      <div className="view-toolbar">
        <div>
          <h2>Every little moment</h2>
          <p>
            {logs.length} {logs.length === 1 ? "entry" : "entries"} in this
            child’s care story.
          </p>
        </div>
        <div className="button-group">
          <button
            className="button secondary"
            onClick={csv}
            disabled={!filtered.length}
          >
            <ArrowDownToLine size={16} />
            Export CSV
          </button>
          <button className="button primary" onClick={() => add("MEDICINE")}>
            <Plus size={16} />
            Add entry
          </button>
        </div>
      </div>
      <section className="card history-card">
        <div className="history-controls">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search care history"
              placeholder="Search medicines, symptoms, notes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(50);
              }}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="date-filter">
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setLimit(50);
                }}
                max={to || undefined}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setLimit(50);
                }}
                min={from || undefined}
              />
            </label>
          </div>
        </div>
        <div className="filter-row">
          <div
            className="segmented"
            role="group"
            aria-label="Filter by record type"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                aria-pressed={type === f.value}
                className={type === f.value ? "selected" : ""}
                onClick={() => {
                  setType(f.value);
                  setLimit(50);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="tiny-label">
            {filtered.length} {filtered.length === 1 ? "ENTRY" : "ENTRIES"}
          </span>
        </div>
        {filtered.length ? (
          <div className="history-groups">
            {[...grouped].map(([day, entries]) => (
              <section key={day}>
                <div className="history-date">
                  <span>
                    {day === localDate(now)
                      ? "Today"
                      : new Date(`${day}T12:00:00`).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                  </span>
                  <span>
                    {entries.length}{" "}
                    {entries.length === 1 ? "moment" : "moments"}
                  </span>
                </div>
                <EntryList logs={entries} onEdit={edit} />
              </section>
            ))}
            {filtered.length > limit && (
              <button
                className="button secondary load-more"
                onClick={() => setLimit(limit + 50)}
              >
                Show more entries
              </button>
            )}
            <p className="field-hint history-hint">
              Select any entry to edit its details or remove it.
            </p>
          </div>
        ) : (
          <EmptyState
            title={
              logs.length
                ? "No matching moments."
                : "Their care story starts here."
            }
            text={
              logs.length
                ? "Try a different search or date range."
                : "Every dose, symptom, and check-in will have a place here."
            }
            action={
              logs.length ? (
                <button
                  className="text-button"
                  onClick={() => {
                    setSearch("");
                    setType("all");
                    setFrom("");
                    setTo("");
                  }}
                >
                  Clear filters <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  className="button primary"
                  onClick={() => add("MEDICINE")}
                >
                  <Plus size={16} />
                  Log the first entry
                </button>
              )
            }
          />
        )}
      </section>
    </>
  );
}

export function ReportsView({ child, logs }: { child: Child; logs: Log[] }) {
  const { db, now, notify } = useCare();
  const [from, setFrom] = useState(() => localDate(now - 6 * 86400000));
  const [to, setTo] = useState(() => localDate(now));
  const [type, setType] = useState("all");
  const [copyFallback, setCopyFallback] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const filtered = filterLogs(logs, { type, from, to });
  const report = makeReport(child.name, filtered, db!.settings, from, to);
  const rangeValid = !from || !to || from <= to;
  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      notify("Report copied. Ready to share.");
    } catch {
      setCopyFallback(true);
      notify("Select and copy the report below.");
    }
  }
  return (
    <div className="reports-grid">
      <div className="report-controls">
        <section className="card">
          <IconBox icon={FileText} />
          <h2 className="report-title">Ready for their next visit.</h2>
          <p className="section-description">
            Turn the little moments into a clear summary for your healthcare
            provider.
          </p>
          <div className="form-stack">
            <div className="form-grid">
              <label>
                From
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <div className="time-shortcuts">
              <button
                onClick={() => {
                  setFrom(localDate(now));
                  setTo(localDate(now));
                }}
              >
                Today
              </button>
              <button
                onClick={() => {
                  setFrom(localDate(now - 6 * 86400000));
                  setTo(localDate(now));
                }}
              >
                Last 7 days
              </button>
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                All time
              </button>
            </div>
            <label>
              Include
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            {!rangeValid && (
              <p role="alert" className="form-error">
                The end date must be on or after the start date.
              </p>
            )}
            <button
              className="button primary"
              onClick={copy}
              disabled={!rangeValid}
            >
              <Copy size={16} />
              Copy report
            </button>
            <div className="button-group">
              <button
                className="button secondary"
                disabled={!rangeValid}
                onClick={() => {
                  downloadFile(
                    report,
                    `kiddymeds-${child.name.replace(/[^a-zA-Z0-9]/g, "-")}-${localDate(now)}.txt`,
                  );
                  notify("Report downloaded.");
                }}
              >
                <ArrowDownToLine size={16} />
                Download
              </button>
              <button
                className="button secondary"
                disabled={!rangeValid}
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print / PDF
              </button>
            </div>
          </div>
        </section>
        <div className="report-tip">
          <ShieldCheck size={19} />
          <p>
            Nothing is sent automatically. You decide when and how to share your
            child’s care records.
          </p>
        </div>
      </div>
      <section className="card report-preview">
        <div className="report-preview-top">
          <span className="eyebrow">REPORT PREVIEW</span>
          <span className="pill-label">{filtered.length} entries</span>
        </div>
        <div className="print-report">
          <div className="print-brand">
            <Heart size={18} />
            KiddyMeds
          </div>
          <h2>{child.name}’s care report</h2>
          <p className="report-period">
            {from || "Beginning"} — {to || "Today"}
          </p>
          <div className="report-totals">
            <span>
              <strong>
                {filtered.filter((l) => l.type === "MEDICINE").length}
              </strong>{" "}
              medicine entries
            </span>
            <span>
              <strong>
                {filtered.filter((l) => l.type === "SYMPTOM").length}
              </strong>{" "}
              symptoms
            </span>
            <span>
              <strong>
                {filtered.filter((l) => l.type === "METRIC").length}
              </strong>{" "}
              check-ins
            </span>
          </div>
          {copyFallback ? (
            <textarea
              className="report-text"
              readOnly
              value={report}
              ref={textRef}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Report text to copy"
              autoFocus
            />
          ) : (
            <pre className="report-text">
              {report.split("\n").slice(4).join("\n")}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}

export function SettingsView({
  addChild,
  editChild,
}: {
  addChild: () => void;
  editChild: (child: Child) => void;
}) {
  const {
    db,
    update,
    restore,
    notify,
    now,
    problem,
    demo,
    startDemo,
    endDemo,
  } = useCare();
  const [pending, setPending] = useState<Database | null>(null);
  const [reset, setReset] = useState(false);
  const [importError, setImportError] = useState("");
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!db) return null;
  const database = db;
  function backup() {
    downloadFile(
      JSON.stringify(database, null, 2),
      `kiddymeds-${demo ? "demo-" : ""}backup-${localDate(now)}.json`,
      "application/json",
    );
    notify("Backup downloaded. Keep it somewhere safe.");
  }
  async function readBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    if (file.size > 20 * 1024 * 1024) {
      setImportError("Please choose a backup smaller than 20 MB.");
      return;
    }
    setReading(true);
    try {
      setPending(parseDatabase(JSON.parse(await file.text())));
    } catch (err) {
      setImportError(
        err instanceof Error && err.message !== "Unexpected end of JSON input"
          ? err.message
          : "This file couldn’t be read. Choose a valid KiddyMeds JSON backup.",
      );
    } finally {
      setReading(false);
    }
  }
  return (
    <>
      <div className="settings-grid">
        <div className="settings-main">
          <section className="card settings-card">
            <SectionHeading
              title="Your little ones"
              aside={
                <button className="text-button" onClick={addChild}>
                  <Plus size={14} />
                  Add child
                </button>
              }
            />
            <p className="section-description">
              A separate care story for each member of the family.
            </p>
            {db.children.map((c) => (
              <button
                className="profile-row"
                key={c.id}
                onClick={() => editChild(c)}
              >
                <span className={`child-initial ${c.color}`}>
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {db.logs.filter((l) => l.childId === c.id).length} care
                    entries
                    {c.birthday
                      ? ` · Born ${new Date(`${c.birthday}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : ""}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
          <section className="card settings-card">
            <SectionHeading title="Make yourself at home" />
            <div className="preference-row">
              <div>
                <strong>Temperature</strong>
                <p>Previous readings convert automatically.</p>
              </div>
              <div
                className="segmented"
                role="group"
                aria-label="Temperature unit"
              >
                {(["F", "C"] as const).map((unit) => (
                  <button
                    key={unit}
                    className={db.settings.tempUnit === unit ? "selected" : ""}
                    aria-pressed={db.settings.tempUnit === unit}
                    onClick={() =>
                      update(
                        (database) => ({
                          ...database,
                          settings: { ...database.settings, tempUnit: unit },
                        }),
                        "Temperature preference updated.",
                      )
                    }
                  >
                    °{unit}
                  </button>
                ))}
              </div>
            </div>
            <div className="preference-row">
              <div>
                <strong>Time format</strong>
                <p>Whatever feels most familiar.</p>
              </div>
              <div className="segmented" role="group" aria-label="Time format">
                {(["12h", "24h"] as const).map((format) => (
                  <button
                    key={format}
                    className={
                      db.settings.timeFormat === format ? "selected" : ""
                    }
                    aria-pressed={db.settings.timeFormat === format}
                    onClick={() =>
                      update(
                        (database) => ({
                          ...database,
                          settings: {
                            ...database.settings,
                            timeFormat: format,
                          },
                        }),
                        "Time preference updated.",
                      )
                    }
                  >
                    {format === "12h" ? "12 hour" : "24 hour"}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="card settings-card">
            <SectionHeading
              title="Keep a safe copy"
              aside={<ArrowDownToLine size={19} />}
            />
            <p className="section-description">
              Your records live in this browser. A backup keeps them safe if you
              change devices or clear your browser’s data.
            </p>
            <div className="backup-actions">
              <button className="button primary" onClick={backup}>
                <ArrowDownToLine size={16} />
                Download backup
              </button>
              <button
                className="button secondary"
                onClick={() => input.current?.click()}
                disabled={reading}
              >
                <Upload size={16} />
                {reading ? "Checking backup…" : "Restore backup"}
              </button>
              <input
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose backup file"
                ref={input}
                type="file"
                accept=".json,application/json"
                onChange={readBackup}
              />
            </div>
            <p className="field-hint">
              Backups include every child, care record, and preference. Original
              KiddyMeds backups are supported.
            </p>
            {importError && (
              <p role="alert" className="form-error">
                {importError}
              </p>
            )}
            {problem && (
              <button
                className="text-button"
                onClick={() => {
                  try {
                    const raw =
                      localStorage.getItem(STORAGE_KEY) ||
                      localStorage.getItem(LEGACY_KEY);
                    if (raw)
                      downloadFile(
                        raw,
                        "kiddymeds-original-data.json",
                        "application/json",
                      );
                    else notify("No stored data is available to download.");
                  } catch {
                    notify("Browser storage is unavailable.");
                  }
                }}
              >
                Download original stored data for recovery{" "}
                <ArrowDownToLine size={14} />
              </button>
            )}
          </section>
          <section className="card settings-card reset-card">
            <div>
              <strong>Start fresh</strong>
              <p>
                Remove all profiles and care records from this version of the
                app.
              </p>
            </div>
            <button
              className="button danger-ghost"
              onClick={() => setReset(true)}
            >
              Reset data
            </button>
          </section>
        </div>
        <aside className="settings-aside">
          <section className="card privacy-explanation">
            <span className="privacy-shield">
              <ShieldCheck size={32} strokeWidth={1.4} />
            </span>
            <h2>
              Private by design.
              <br />
              Peace of mind included.
            </h2>
            <p>
              No account to create. No family records sent to a server. No
              analytics or tracking scripts.
            </p>
            <ul>
              <li>
                <Check size={16} />
                Saved in this browser
              </li>
              <li>
                <Check size={16} />
                Works offline after the first visit
              </li>
              <li>
                <Check size={16} />
                You choose what to share
              </li>
            </ul>
            <p className="field-hint">
              People with access to this device and browser can access these
              records. Local storage and downloaded backups aren’t encrypted by
              KiddyMeds.
            </p>
          </section>
          <section className="card demo-card">
            <CirclePlay size={22} />
            <h3>A little look around?</h3>
            <p>Explore example care records without changing your own.</p>
            <button
              className="text-button"
              onClick={demo ? endDemo : startDemo}
            >
              {demo ? "Leave demo" : "Explore the demo"}
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="settings-disclaimer">
            <Info size={16} />
            <p>
              KiddyMeds is for personal organization. It doesn’t provide medical
              advice, diagnose symptoms, or recommend doses. Follow your
              healthcare provider’s care plan.
            </p>
          </div>
        </aside>
      </div>
      {pending && (
        <Modal
          title="Restore this backup?"
          subtitle={`${pending.children.length} ${pending.children.length === 1 ? "child" : "children"} · ${pending.logs.length} care records · ${pending.customMedicines.length} custom shortcuts`}
          onClose={() => setPending(null)}
        >
          <div className="inline-note">
            <ShieldCheck size={18} />
            <p>
              This will replace{" "}
              {demo ? "the demo’s records" : "your current records"}. Download a
              backup first if you want to keep them. Your selected file has been
              checked for valid profiles and records.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (restore(pending)) setPending(null);
              }}
            >
              Restore & replace
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title={demo ? "Reset this demo?" : "Start with a clean slate?"}
          subtitle="This removes every child profile and care entry from the current app. Keep a backup before continuing."
          onClose={() => setReset(false)}
        >
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setReset(false)}
            >
              Keep my records
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (restore(emptyDatabase())) {
                  notify("Care records reset. A fresh start.");
                  setReset(false);
                }
              }}
            >
              Reset all data
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
