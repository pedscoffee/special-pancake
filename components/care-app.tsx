"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bath,
  ChevronRight,
  Clock3,
  CircleAlert,
  FileText,
  Heart,
  House,
  LayoutGrid,
  Pill,
  CalendarPlus,
  Pencil,
  Plus,
  Settings2,
  Search,
  ShieldCheck,
  CirclePlay,
  Thermometer,
  Utensils,
  Droplets,
  WifiOff,
  X,
} from "lucide-react";
import { assertUnchangedLog } from "@/lib/record-updates";
import type { Child, Log, LogType, MedicineFavorite, View } from "@/lib/types";
import {
  childLogs,
  convertTemperature,
  duration,
  formatTime,
  isStatusLog,
  localDate,
  MEDICINES,
  METRICS,
  runningTimers,
  todayLogs,
} from "@/lib/care";
import { filterSymptoms, SYMPTOM_GROUPS } from "@/lib/symptoms";
import { symptomAppearance } from "./symptom-icons";
import { useCare } from "./care-provider";
import {
  ClockNote,
  EmptyState,
  EntryList,
  IconBox,
  Modal,
  SectionHeading,
} from "./ui";
import { EntryForm } from "./entry-form";
import { DailyCheckInForm } from "./daily-checkin-form";
import { ChildForm } from "./child-form";
import { CareStatus, GotSickLine, StatusForm } from "./care-status";
import { InstallPrompt } from "./install-prompt";
import { QuickNegatives } from "./quick-negatives";
import { ChildMenu } from "./child-menu";
import { HandoffSheet } from "./handoff-sheet";
import { ReceiveDialog } from "./receive-care";
import { CalendarAlertButton, CalendarAlertDialog } from "./calendar-alert";
import { HistoryView, ReportsView, SettingsView } from "./record-views";

const NAV = [
  { view: "overview", label: "Overview", href: "/", icon: LayoutGrid },
  { view: "medicines", label: "Medicines", href: "/medicines/", icon: Pill },
  {
    view: "symptoms",
    label: "Symptoms & care",
    href: "/symptoms/",
    icon: Heart,
  },
  { view: "history", label: "Care history", href: "/history/", icon: Clock3 },
  { view: "reports", label: "Reports", href: "/reports/", icon: FileText },
] as const;
type Popup =
  | { kind: "daily-checkin"; childId: string }
  | {
      kind: "entry";
      childId: string;
      type: LogType;
      name?: string;
      log?: Log;
      favorite?: MedicineFavorite;
    }
  | { kind: "child"; child?: Child }
  | { kind: "handoff"; child: Child }
  | { kind: "receive" }
  | { kind: "status"; log: Log }
  | { kind: "delete-log"; log: Log }
  | { kind: "delete-child"; child: Child; logs: Log[] };
export type EntryAction = (
  type: LogType,
  name?: string,
  favorite?: MedicineFavorite,
) => void;

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="KiddyMeds overview">
      <span className="brand-mark">
        <Heart size={26} strokeWidth={2.1} />
      </span>
      <span>
        Kiddy<span className="brand-med">Meds</span>
        <small>A little care goes a long way.</small>
      </span>
    </Link>
  );
}
function Garden() {
  return (
    <svg
      className="garden"
      viewBox="0 0 320 185"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="169"
        cy="161"
        rx="119"
        ry="12"
        fill="#c5d7c8"
        opacity=".45"
      />
      <path
        d="M90 158V77M90 119C63 119 56 99 61 92C76 90 90 100 90 119Z"
        stroke="#96a789"
        strokeWidth="5"
        strokeLinecap="round"
        fill="#b3c2a4"
      />
      <path
        d="M204 157V74M204 117C227 117 237 98 231 89C213 92 204 104 204 117Z"
        stroke="#96a789"
        strokeWidth="5"
        strokeLinecap="round"
        fill="#b3c2a4"
      />
      <path
        d="M140 159V105M140 139C121 136 115 122 120 117C132 119 140 127 140 139Z"
        stroke="#96a789"
        strokeWidth="4"
        strokeLinecap="round"
        fill="#b3c2a4"
      />
      <g fill="#8daa91">
        <ellipse cx="90" cy="44" rx="16" ry="23" />
        <ellipse cx="90" cy="84" rx="16" ry="23" />
        <ellipse cx="69" cy="64" rx="23" ry="16" />
        <ellipse cx="111" cy="64" rx="23" ry="16" />
      </g>
      <circle cx="90" cy="64" r="13" fill="#f3e8be" />
      <circle cx="87" cy="62" r="1.5" fill="#8e794c" />
      <circle cx="94" cy="62" r="1.5" fill="#8e794c" />
      <path
        d="M87 68Q90 71 94 67"
        stroke="#8e794c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill="#ebbeaa">
        <ellipse cx="204" cy="41" rx="15" ry="21" />
        <ellipse cx="204" cy="77" rx="15" ry="21" />
        <ellipse cx="185" cy="59" rx="21" ry="15" />
        <ellipse cx="223" cy="59" rx="21" ry="15" />
      </g>
      <circle cx="204" cy="59" r="12" fill="#fff0ce" />
      <circle cx="200" cy="57" r="1.4" fill="#9d805b" />
      <circle cx="207" cy="57" r="1.4" fill="#9d805b" />
      <path
        d="M201 63Q204 66 208 62"
        stroke="#9d805b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill="#e5cd83">
        <ellipse cx="140" cy="83" rx="11" ry="16" />
        <ellipse cx="140" cy="109" rx="11" ry="16" />
        <ellipse cx="126" cy="96" rx="16" ry="11" />
        <ellipse cx="154" cy="96" rx="16" ry="11" />
      </g>
      <circle cx="140" cy="96" r="9" fill="#fff4d9" />
      <path
        d="M260 52v12m-6-6h12M42 111v10m-5-5h10"
        stroke="#a4bca6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="163" cy="37" r="3" fill="#b4c9b7" />
      <circle cx="267" cy="126" r="4" fill="#ccdbcd" />
      <path
        d="M162 151C170 130 186 132 187 142C181 150 169 153 162 151ZM245 156C246 137 256 131 263 136C263 147 253 156 245 156Z"
        fill="#b3c2a4"
      />
    </svg>
  );
}

export function CareApp({ view }: { view: View }) {
  const care = useCare();
  const { db, ready, now, demo, online, problem, toast, update, saving } = care;
  const [popup, setPopup] = useState<Popup | null>(null);
  const [undo, setUndo] = useState<Log | null>(null);
  const activeChild =
    db?.children.find((c) => c.id === db.settings.activeChildId) ||
    db?.children[0];
  const logs = db && activeChild ? childLogs(db, activeChild.id) : [];
  const add: EntryAction = (type, name, favorite) => {
    if (!activeChild) return;
    setPopup(
      type === "METRIC" && !name
        ? { kind: "daily-checkin", childId: activeChild.id }
        : { kind: "entry", childId: activeChild.id, type, name, favorite },
    );
  };
  const edit = (log: Log) =>
    setPopup(
      isStatusLog(log)
        ? { kind: "status", log }
        : { kind: "entry", childId: log.childId, type: log.type, log },
    );
  const title =
    view === "overview"
      ? "Overview"
      : view === "symptoms"
        ? "Symptoms & care"
        : view === "history"
          ? "Care history"
          : view.charAt(0).toUpperCase() + view.slice(1);
  async function deleteEntry(log: Log) {
    if (
      await update((database) => {
        assertUnchangedLog(database, log);
        return {
          ...database,
          logs: database.logs.filter((l) => l.id !== log.id),
        };
      }, "Entry removed.")
    ) {
      setUndo(log);
      setPopup(null);
    }
  }
  async function undoDelete() {
    if (!undo) return;
    if (
      await update((database) => {
        if (!database.children.some((child) => child.id === undo.childId))
          throw new Error(
            "This child profile was removed. The entry couldn’t be restored.",
          );
        if (database.logs.some((log) => log.id === undo.id))
          throw new Error("This entry was already restored in another tab.");
        return { ...database, logs: [...database.logs, undo] };
      }, "Entry restored.")
    )
      setUndo(null);
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-section-label">YOUR FAMILY’S CARE</div>
        <nav aria-label="Main navigation">
          {NAV.map(({ view: item, label, href, icon: Icon }) => (
            <Link
              key={item}
              href={href}
              className={`nav-link ${view === item ? "active" : ""}`}
              aria-current={view === item ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{label}</span>
              {view === item && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={23} strokeWidth={1.5} />
            <strong>Your family. Your privacy.</strong>
            <p>
              Care records stay right here,
              <br />
              on your device.
            </p>
            <Link href="/settings/">
              Privacy and backups <ArrowRight size={13} />
            </Link>
          </div>
          <Link
            href="/settings/"
            className={`nav-link ${view === "settings" ? "active" : ""}`}
            aria-current={view === "settings" ? "page" : undefined}
          >
            <Settings2 size={20} strokeWidth={1.7} />
            Settings
          </Link>
          <button
            className="demo-link"
            onClick={demo ? care.endDemo : care.startDemo}
          >
            {demo ? "Leave demo" : "Take a peek at the demo"}
            <CirclePlay size={13} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            <House size={16} />
            <ChevronRight size={13} />
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              {problem ? (
                <CircleAlert size={14} />
              ) : online ? (
                <span className="status-dot" />
              ) : (
                <WifiOff size={14} />
              )}
              {!ready ? (
                "Getting ready…"
              ) : problem ? (
                "Storage needs attention"
              ) : demo ? (
                "Preview mode"
              ) : online ? (
                <span className="local-status-text">Saved on this device</span>
              ) : (
                "You’re offline"
              )}
            </span>
            {ready && db && activeChild && (
              <ChildMenu
                onAdd={() => setPopup({ kind: "child" })}
                onEdit={(child) => setPopup({ kind: "child", child })}
                onHandoff={(child) => setPopup({ kind: "handoff", child })}
                onReceive={() => setPopup({ kind: "receive" })}
              />
            )}
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {demo && (
            <div className="demo-banner">
              <CirclePlay size={17} />
              <span>
                You’re exploring a demo. These sample records are separate from
                your family’s data.
              </span>
              <button onClick={care.endDemo}>
                Leave demo <X size={14} />
              </button>
            </div>
          )}
          {problem && (
            <div className="error-banner" role="alert">
              {problem}
              <Link href="/settings/">
                Go to Settings <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>
                {view === "overview"
                  ? "Log care and see today at a glance."
                  : view === "medicines"
                    ? "Record doses and see the intervals you entered."
                    : view === "symptoms"
                      ? "Record symptoms and daily check-ins."
                      : view === "history"
                        ? "Search, edit, share and export every entry."
                        : view === "reports"
                          ? "A sick-visit summary to show your doctor."
                          : "Backups, preferences, and child profiles."}
              </p>
            </div>
            <span className="heading-date">
              <span>
                {now
                  ? new Date(now).toLocaleDateString("en-US", {
                      weekday: "long",
                    })
                  : "Today"}
              </span>
              {now
                ? new Date(now).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Your care companion"}
            </span>
          </div>
          {!ready || !db || !activeChild ? (
            <div className="loading-state" role="status">
              <span className="loading-heart">
                <Heart size={28} />
              </span>
              Getting your care space ready…
            </div>
          ) : (
            <>
              {view === "overview" && (
                <Overview
                  child={activeChild}
                  logs={logs}
                  add={add}
                  edit={edit}
                />
              )}
              {view === "medicines" && (
                <MedicinesView logs={logs} add={add} edit={edit} />
              )}
              {view === "symptoms" && (
                <SymptomsView
                  childId={activeChild.id}
                  logs={logs}
                  add={add}
                  edit={edit}
                />
              )}
              {view === "history" && (
                <HistoryView
                  child={activeChild}
                  logs={logs}
                  edit={edit}
                  add={add}
                />
              )}
              {view === "reports" && (
                <ReportsView child={activeChild} logs={logs} />
              )}
              {view === "settings" && (
                <SettingsView
                  addChild={() => setPopup({ kind: "child" })}
                  editChild={(child) => setPopup({ kind: "child", child })}
                />
              )}
              <footer className="page-footer">
                <span>
                  For personal tracking. Follow your healthcare provider’s
                  instructions.
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map(({ view: item, label, href, icon: Icon }) => (
          <Link
            key={item}
            href={href}
            className={view === item ? "active" : ""}
            aria-current={view === item ? "page" : undefined}
          >
            <Icon size={21} strokeWidth={1.7} />
            <span>
              {item === "symptoms"
                ? "Symptoms"
                : item === "history"
                  ? "History"
                  : label}
            </span>
          </Link>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">✓</span>
          {toast}
          {undo && toast === "Entry removed." && (
            <button onClick={undoDelete}>Undo</button>
          )}
        </div>
      )}
      {popup?.kind === "entry" && activeChild && (
        <EntryForm
          key={`${popup.childId}:${popup.log?.id || `${popup.type}-${popup.name}`}`}
          kind={popup.type}
          name={popup.name}
          favorite={popup.favorite}
          log={popup.log}
          childId={popup.childId}
          onClose={() => setPopup(null)}
          onDelete={(log) => setPopup({ kind: "delete-log", log })}
        />
      )}
      {popup?.kind === "status" && (
        <StatusForm
          key={popup.log.id}
          childId={popup.log.childId}
          log={popup.log}
          onClose={() => setPopup(null)}
          onDelete={(log) => setPopup({ kind: "delete-log", log })}
        />
      )}
      {popup?.kind === "handoff" && db && (
        <HandoffSheet
          child={popup.child}
          logs={childLogs(db, popup.child.id)}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.kind === "receive" && (
        <ReceiveDialog onClose={() => setPopup(null)} />
      )}
      {popup?.kind === "daily-checkin" && activeChild && (
        <DailyCheckInForm
          key={popup.childId}
          childId={popup.childId}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.kind === "child" && (
        <ChildForm
          child={popup.child}
          onClose={() => setPopup(null)}
          onDelete={(child) =>
            setPopup({
              kind: "delete-child",
              child,
              logs: db!.logs.filter((log) => log.childId === child.id),
            })
          }
        />
      )}
      {popup?.kind === "delete-log" && (
        <Modal
          title="Remove this entry?"
          subtitle="You can undo this immediately after removing it."
          onClose={() => {
            if (!saving) setPopup(null);
          }}
        >
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setPopup(null)}
            >
              Keep entry
            </button>
            <button
              className="button danger"
              disabled={saving}
              onClick={() => deleteEntry(popup.log)}
            >
              Remove entry
            </button>
          </div>
        </Modal>
      )}
      {popup?.kind === "delete-child" && (
        <Modal
          title={`Remove ${popup.child.name}?`}
          subtitle={`This removes their profile and all ${db?.logs.filter((l) => l.childId === popup.child.id).length || 0} care records. Export a backup in Settings first if you’d like to keep them.`}
          onClose={() => {
            if (!saving) setPopup(null);
          }}
        >
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setPopup(null)}
            >
              Keep profile
            </button>
            <button
              className="button danger"
              disabled={saving}
              onClick={async () => {
                if (
                  await update((database) => {
                    if (database.children.length < 2)
                      throw new Error("Keep at least one child profile.");
                    const latest = database.children.find(
                      (child) => child.id === popup.child.id,
                    );
                    const originalLogs = popup.logs;
                    if (
                      !latest ||
                      latest.name !== popup.child.name ||
                      latest.color !== popup.child.color ||
                      latest.birthday !== popup.child.birthday ||
                      JSON.stringify(
                        database.logs.filter(
                          (log) => log.childId === popup.child.id,
                        ),
                      ) !== JSON.stringify(originalLogs)
                    )
                      throw new Error(
                        "This child’s records changed in another tab. Cancel and review them before removing the profile.",
                      );
                    const children = database.children.filter(
                      (c) => c.id !== popup.child.id,
                    );
                    return {
                      ...database,
                      children,
                      medicineFavorites: database.medicineFavorites?.filter(
                        (item) => item.childId !== popup.child.id,
                      ),
                      logs: database.logs.filter(
                        (l) => l.childId !== popup.child.id,
                      ),
                      settings: {
                        ...database.settings,
                        activeChildId: children[0].id,
                      },
                    };
                  }, "Profile removed.")
                )
                  setPopup(null);
              }}
            >
              Remove profile & records
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Overview({
  child,
  logs,
  add,
  edit,
}: {
  child: Child;
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
  const { db, demo, startDemo } = useCare();
  return (
    <>
      <CareStatus child={child} logs={logs} />
      {!demo && <InstallPrompt hasRecords={!!db?.logs.length} />}
      <OverviewMedicines child={child} logs={logs} add={add} edit={edit} />
      <GotSickLine child={child} logs={logs} />
      <TodayCard child={child} logs={logs} add={add} />
      {logs.length > 0 && (
        <section className="card activity-card">
          <SectionHeading
            title="Recent care"
            aside={
              <Link className="text-button" href="/history/">
                View history <ArrowRight size={14} />
              </Link>
            }
          />
          <EntryList logs={logs.slice(0, 5)} onEdit={edit} compact />
        </section>
      )}
      {!logs.length && (
        <div className="welcome-card">
          <div>
            <h2>
              {child.name === "Your child"
                ? "Their care, in good hands."
                : `${child.name}’s care, in good hands.`}
            </h2>
            <p>
              Medicines, symptoms, and all the in-between. <br />
              You take care of them. We’ll help with the remembering.
            </p>
            {!demo && (
              <button className="text-button" onClick={startDemo}>
                Explore an example <ArrowRight size={14} />
              </button>
            )}
          </div>
          <Garden />
        </div>
      )}
    </>
  );
}

/** Medicine clocks first; favorites without a running clock as chips below. */
function OverviewMedicines({
  child,
  logs,
  add,
  edit,
}: {
  child: Child;
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
  const { db, now } = useCare();
  const [open, setOpen] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<{
    log: Log;
    target: number;
  } | null>(null);
  const timers = runningTimers(logs, now);
  const clockNames = new Set(
    timers.map((t) => t.log.data.medicineName!.trim().toLowerCase()),
  );
  const favorites = (db?.medicineFavorites || []).filter(
    (f) =>
      f.childId === child.id && !clockNames.has(f.name.trim().toLowerCase()),
  );
  const selected = timers.find((t) => t.log.id === open);
  return (
    <section className="card overview-medicines" aria-labelledby="meds-title">
      <div className="section-heading">
        <h2 id="meds-title">Medicines</h2>
        <button
          className="button primary small"
          aria-label="Log a medicine"
          onClick={() => add("MEDICINE")}
        >
          <Plus size={16} />
          Log medicine
        </button>
      </div>
      {timers.length > 0 && (
        <div className="timers">
          {timers.map(({ log, target, remaining, elapsed }) => {
            const percent = Math.min(
              100,
              Math.max(
                0,
                (elapsed / (log.data.frequencyHours! * 3600000)) * 100,
              ),
            );
            return (
              <button
                className="timer clock-button"
                key={log.id}
                aria-label={`${log.data.medicineName}: ${remaining > 0 ? `${duration(remaining)} until recorded interval` : "interval passed"}. Options`}
                onClick={() => setOpen(log.id)}
              >
                <div className="timer-header">
                  <div className="timer-name">
                    <IconBox icon={Pill} small />
                    <div>
                      <strong>{log.data.medicineName}</strong>
                      <span>
                        Logged at{" "}
                        {formatTime(log.timeGiven, db!.settings.timeFormat)}
                      </span>
                    </div>
                  </div>
                  <div className="timer-value">
                    <strong>
                      {remaining > 0 ? duration(remaining) : "Interval passed"}
                    </strong>
                    <span>
                      {remaining > 0
                        ? `until ${formatTime(target, db!.settings.timeFormat)}`
                        : `${duration(elapsed)} since last dose`}
                    </span>
                  </div>
                </div>
                <div className="timer-progress" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
      {favorites.length > 0 && (
        <div className="favorite-buttons overview-favorites">
          {favorites.map((favorite) => (
            <button
              key={favorite.id}
              className="button secondary"
              onClick={() => add("MEDICINE", favorite.name, favorite)}
            >
              <Pill size={16} />
              {favorite.name}
            </button>
          ))}
        </div>
      )}
      {!timers.length && !favorites.length && (
        <p className="field-hint">
          Add the interval from your care instructions when you log a medicine
          to see a clock here. Tap a clock to give that medicine again.
        </p>
      )}
      {timers.length > 0 && (
        <ClockNote>
          Clocks reflect the intervals you record. Always follow your care
          instructions.
        </ClockNote>
      )}
      {selected && (
        <Modal
          title={selected.log.data.medicineName!}
          subtitle={`Last logged ${formatTime(selected.log.timeGiven, db!.settings.timeFormat)} · ${selected.log.data.frequencyHours}h recorded interval`}
          onClose={() => setOpen(null)}
        >
          <div className="clock-sheet">
            <button
              className="button primary"
              onClick={() => {
                setOpen(null);
                add("MEDICINE", selected.log.data.medicineName, {
                  id: "",
                  childId: child.id,
                  name: selected.log.data.medicineName!,
                  dosage: selected.log.data.dosage || "",
                  frequencyHours: selected.log.data.frequencyHours ?? null,
                });
              }}
            >
              <Plus size={16} />
              Give again
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setOpen(null);
                edit(selected.log);
              }}
            >
              <Pencil size={16} />
              Edit last entry
            </button>
            {selected.remaining > 0 && (
              <button
                className="button secondary"
                aria-label={`Add a calendar alert for the end of the recorded ${selected.log.data.medicineName} interval`}
                onClick={() => {
                  setOpen(null);
                  setCalendarFor({
                    log: selected.log,
                    target: selected.target,
                  });
                }}
              >
                <CalendarPlus size={16} />
                Calendar alert
              </button>
            )}
          </div>
        </Modal>
      )}
      {calendarFor && (
        <CalendarAlertDialog
          log={calendarFor.log}
          target={calendarFor.target}
          onClose={() => setCalendarFor(null)}
        />
      )}
    </section>
  );
}

/** Today at a glance and the daily check-in, together. */
function TodayCard({
  child,
  logs,
  add,
}: {
  child: Child;
  logs: Log[];
  add: EntryAction;
}) {
  const { db, now } = useCare();
  const today = todayLogs(logs, now);
  const medicines = today.filter((l) => l.type === "MEDICINE");
  const symptoms = today.filter((l) => l.type === "SYMPTOM");
  const temperature = logs.find((l) => l.data.temp);
  const symptomNames = new Set(symptoms.map((l) => l.data.symptomName));
  return (
    <section className="card today-card" aria-labelledby="today-title">
      <div className="section-heading">
        <h2 id="today-title">
          Today <span>{child.name}</span>
        </h2>
        <div className="button-group">
          <button
            className="button secondary small"
            aria-label="Log a symptom"
            onClick={() => add("SYMPTOM")}
          >
            <Thermometer size={16} />
            Symptom
          </button>
          <button
            className="button secondary small"
            aria-label="Daily check-in"
            onClick={() => add("METRIC")}
          >
            <Droplets size={16} />
            Check in
          </button>
        </div>
      </div>
      <div className="today-stats">
        <div>
          <span>Medicines</span>
          <strong>{medicines.length}</strong>
          <small>
            {medicines.length
              ? `Last at ${formatTime(medicines[0].timeGiven, db!.settings.timeFormat)}`
              : "None today"}
          </small>
        </div>
        <div>
          <span>Latest temp</span>
          <strong>
            {temperature
              ? `${convertTemperature(temperature.data.temp!, temperature.data.tempUnit || db!.settings.tempUnit, db!.settings.tempUnit)}°${db!.settings.tempUnit}`
              : "—"}
          </strong>
          <small>
            {temperature
              ? `${localDate(temperature.timeGiven) === localDate(now) ? "Today" : new Date(temperature.timeGiven).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${formatTime(temperature.timeGiven, db!.settings.timeFormat)}`
              : "None recorded"}
          </small>
        </div>
        <div>
          <span>Symptoms</span>
          <strong>{symptoms.length}</strong>
          <small>
            {symptoms.length
              ? `${symptomNames.size} ${symptomNames.size === 1 ? "kind" : "kinds"} today`
              : "None today"}
          </small>
        </div>
      </div>
    </section>
  );
}

/** Medicines page: only clocks with time still to run (the overview has all). */
export function TimerPanel({ logs }: { logs: Log[] }) {
  const { db, now } = useCare();
  const timers = runningTimers(logs, now).filter((t) => t.remaining > 0);
  return (
    <section className="card timer-panel">
      <SectionHeading title="Medicine clocks" />
      {timers.length ? (
        <div className="timers">
          {timers.map(({ log, target, remaining, elapsed }) => (
            <div className="timer" key={log.id}>
              <div className="timer-header">
                <div className="timer-name">
                  <IconBox icon={Pill} small />
                  <div>
                    <strong>{log.data.medicineName}</strong>
                    <span>{log.data.dosage || "Dose recorded"}</span>
                  </div>
                </div>
                <div className="timer-value">
                  <strong>
                    {remaining > 0 ? duration(remaining) : "Interval passed"}
                  </strong>
                  <span>
                    {remaining > 0
                      ? "until recorded interval"
                      : `${duration(elapsed)} since last dose`}
                  </span>
                </div>
              </div>
              <div
                className="timer-progress"
                role="progressbar"
                aria-label={`${log.data.medicineName} recorded interval progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  Math.min(
                    100,
                    Math.max(
                      0,
                      (elapsed / (log.data.frequencyHours! * 3600000)) * 100,
                    ),
                  ),
                )}
              >
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, (elapsed / (log.data.frequencyHours! * 3600000)) * 100))}%`,
                  }}
                />
              </div>
              <div className="timer-labels">
                <span>
                  Logged at {formatTime(log.timeGiven, db!.settings.timeFormat)}
                </span>
                <span>
                  {localDate(target) !== localDate(now)
                    ? `${new Date(target).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · `
                    : ""}
                  {formatTime(target, db!.settings.timeFormat)} ·{" "}
                  {log.data.frequencyHours}h interval
                </span>
              </div>
              {remaining > 0 && (
                <CalendarAlertButton log={log} target={target} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="timer-empty">
          <Clock3 size={25} strokeWidth={1.5} />
          <div>
            <strong>A little help with the timing.</strong>
            <p>
              Add your instructed interval when logging a medicine to see a
              clock here.
            </p>
          </div>
        </div>
      )}
      <ClockNote>
        Clocks reflect the intervals you record. Always follow your care
        instructions.
      </ClockNote>
    </section>
  );
}

function MedicineFavorites({
  add,
  compact = false,
}: {
  add: EntryAction;
  compact?: boolean;
}) {
  const { db, update, saving } = useCare();
  const child =
    db?.children.find((item) => item.id === db.settings.activeChildId) ||
    db?.children[0];
  const favorites = (db?.medicineFavorites || []).filter(
    (item) => item.childId === child?.id,
  );
  if (!favorites.length) return null;
  return (
    <section
      className="card medicine-favorites"
      aria-label={`Medicine favorites for ${child?.name}`}
    >
      <SectionHeading title={`Favorites for ${child?.name}`} />
      {!compact && (
        <p className="section-description">
          Your saved details. Open a favorite to review before recording a dose.
        </p>
      )}
      <div className="favorite-buttons">
        {favorites.map((favorite) => (
          <div className="favorite-item" key={favorite.id}>
            <button
              className="button secondary"
              onClick={() => add("MEDICINE", favorite.name, favorite)}
            >
              <Pill size={16} />
              {favorite.name}
            </button>
            {!compact && (
              <button
                className="icon-button"
                aria-label={`Remove ${favorite.name} favorite`}
                disabled={saving}
                onClick={() =>
                  update(
                    (current) => ({
                      ...current,
                      medicineFavorites: (
                        current.medicineFavorites || []
                      ).filter((item) => item.id !== favorite.id),
                    }),
                    "Favorite removed. Care records kept.",
                  )
                }
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function MedicinesView({
  logs,
  add,
  edit,
}: {
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
  const { db, update, now } = useCare();
  const running = runningTimers(logs, now).some((t) => t.remaining > 0);
  const medicineLogs = logs.filter((l) => l.type === "MEDICINE");
  const all = [
    ...MEDICINES,
    ...db!.customMedicines.map((name) => ({
      name,
      detail: "Your custom shortcut",
      color: "sage",
    })),
  ];
  return (
    <>
      <div className="view-toolbar">
        <div>
          <h2>Medicine shortcuts</h2>
          <p>Pick a medicine to record a dose. No doses are suggested.</p>
        </div>
        <button className="button primary" onClick={() => add("MEDICINE")}>
          <Plus size={16} />
          Log medicine
        </button>
      </div>
      <MedicineFavorites add={add} />
      <section className="card shortcut-card" aria-label="Medicine shortcuts">
        <ul className="shortcut-list">
          {all.map((m) => (
            <li className="shortcut-row" key={m.name}>
              <button
                className="shortcut-main"
                aria-label={`Log a dose of ${m.name}`}
                onClick={() => add("MEDICINE", m.name)}
              >
                <IconBox icon={Pill} color={m.color} small />
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.detail}</small>
                </span>
                <Plus size={16} aria-hidden="true" />
              </button>
              {db!.customMedicines.includes(m.name) && (
                <button
                  className="icon-button"
                  aria-label={`Remove ${m.name} shortcut`}
                  onClick={() =>
                    update(
                      (database) => ({
                        ...database,
                        customMedicines: database.customMedicines.filter(
                          (n) => n !== m.name,
                        ),
                      }),
                      "Shortcut removed. Care records kept.",
                    )
                  }
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
          <li className="shortcut-row">
            <button
              className="shortcut-main shortcut-custom"
              onClick={() => add("MEDICINE")}
            >
              <span className="custom-plus" aria-hidden="true">
                <Plus size={18} strokeWidth={1.6} />
              </span>
              <span>
                <strong>Something else?</strong>
                <small>Add your own medicine</small>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <div className={`medicines-lower ${running ? "" : "single"}`}>
        {running && <TimerPanel logs={logs} />}
        <section className="card">
          <SectionHeading
            title="Recent doses"
            aside={
              <Link className="text-button" href="/history/">
                All history <ArrowRight size={14} />
              </Link>
            }
          />
          {medicineLogs.length ? (
            <EntryList logs={medicineLogs.slice(0, 6)} onEdit={edit} />
          ) : (
            <EmptyState
              title="A dose, remembered."
              text="Your medicines will appear here after you record them."
            />
          )}
        </section>
      </div>
    </>
  );
}
function SymptomsView({
  childId,
  logs,
  add,
  edit,
}: {
  childId?: string;
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const symptoms = filterSymptoms(search, group);
  return (
    <>
      <div className="view-toolbar">
        <div>
          <h2>What are you noticing?</h2>
          <p>A small observation can help tell the whole story.</p>
        </div>
        <button className="button primary" onClick={() => add("SYMPTOM")}>
          <Plus size={16} />
          Log symptom
        </button>
      </div>
      <div className="symptom-controls">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Find a symptom"
            placeholder="Find a symptom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
        </div>
        <div
          className="symptom-groups"
          role="group"
          aria-label="Symptom categories"
        >
          {["All", ...SYMPTOM_GROUPS].map((category) => (
            <button
              key={category}
              className={group === category ? "selected" : ""}
              aria-pressed={group === category}
              onClick={() => setGroup(category)}
            >
              {category === "All" ? "All symptoms" : category}
            </button>
          ))}
        </div>
      </div>
      <div className="symptom-grid">
        {symptoms.map((s) => (
          <button
            className="symptom-tile"
            key={s.name}
            onClick={() =>
              add("SYMPTOM", s.name === "Other symptom" ? "" : s.name)
            }
          >
            <IconBox icon={symptomAppearance(s.name).icon} color={s.color} />
            <strong>{s.name}</strong>
            <Plus size={15} />
          </button>
        ))}
      </div>
      {!symptoms.length && (
        <div className="symptom-no-results" role="status">
          <p>No matching shortcuts. You can still record what you noticed.</p>
          <button
            className="text-button"
            onClick={() => add("SYMPTOM", search.trim())}
          >
            <Plus size={15} />
            Log {search.trim() ? `“${search.trim()}”` : "another symptom"}
          </button>
        </div>
      )}
      {childId && <QuickNegatives childId={childId} logs={logs} />}
      <div className="symptoms-lower">
        <section className="card">
          <SectionHeading
            title="Recent observations"
            aside={
              <Link className="text-button" href="/history/">
                View history <ArrowRight size={14} />
              </Link>
            }
          />
          {logs.filter((l) => l.type === "SYMPTOM").length ? (
            <EntryList
              logs={logs.filter((l) => l.type === "SYMPTOM").slice(0, 8)}
              onEdit={edit}
            />
          ) : (
            <EmptyState
              title="The little things you notice."
              text="Record symptoms and temperatures to keep the bigger picture."
            />
          )}
        </section>
        <DailyChecks logs={logs} add={add} />
      </div>
    </>
  );
}
export function DailyChecks({
  logs,
  add,
  compact = false,
}: {
  logs: Log[];
  add: EntryAction;
  compact?: boolean;
}) {
  const { now } = useCare();
  const today = todayLogs(logs, now);
  return (
    <section className={`card daily-checks ${compact ? "compact" : ""}`}>
      <SectionHeading
        title="Daily check-in"
        aside={
          <button className="text-button" onClick={() => add("METRIC")}>
            Check in <Plus size={14} />
          </button>
        }
      />
      <p className="section-description">
        Meals, fluids, and bathroom in one check-in.
      </p>
      {METRICS.map((m, i) => {
        const last = today.find(
          (l) => l.type === "METRIC" && l.data.metricType === m.key,
        );
        const Icon = [Utensils, Droplets, Droplets, Bath][i];
        return (
          <button
            className="daily-check"
            key={m.key}
            onClick={() => add("METRIC", m.key)}
          >
            <Icon size={18} strokeWidth={1.6} />
            <span>{m.name}</span>
            <span className={`daily-value ${last ? "recorded" : ""}`}>
              {last?.data.value || "Add check-in"}
            </span>
            <ChevronRight size={13} />
          </button>
        );
      })}
    </section>
  );
}
