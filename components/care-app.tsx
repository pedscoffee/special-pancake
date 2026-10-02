"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bath,
  ChevronRight,
  Clock3,
  CircleAlert,
  FileText,
  Heart,
  House,
  LayoutGrid,
  ListFilter,
  Pencil,
  Pill,
  Plus,
  Settings2,
  ShieldCheck,
  CirclePlay,
  Thermometer,
  Utensils,
  Droplets,
  WifiOff,
  X,
} from "lucide-react";
import type { Child, Log, LogType, View } from "@/lib/types";
import {
  childLogs,
  convertTemperature,
  duration,
  formatTime,
  localDate,
  MEDICINES,
  METRICS,
  medicineTimers,
  SYMPTOMS,
  todayLogs,
} from "@/lib/care";
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
import { ChildForm } from "./child-form";
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
  | { kind: "entry"; type: LogType; name?: string; log?: Log }
  | { kind: "child"; child?: Child }
  | { kind: "delete-log"; log: Log }
  | { kind: "delete-child"; child: Child };
export type EntryAction = (type: LogType, name?: string) => void;

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
  const { db, ready, now, demo, online, problem, toast, update } = care;
  const [popup, setPopup] = useState<Popup | null>(null);
  const [undo, setUndo] = useState<Log | null>(null);
  const activeChild =
    db?.children.find((c) => c.id === db.settings.activeChildId) ||
    db?.children[0];
  const logs = db && activeChild ? childLogs(db, activeChild.id) : [];
  const add: EntryAction = (type, name) =>
    setPopup({ kind: "entry", type, name });
  const edit = (log: Log) => setPopup({ kind: "entry", type: log.type, log });
  const title =
    view === "overview"
      ? "Overview"
      : view === "symptoms"
        ? "Symptoms & care"
        : view === "history"
          ? "Care history"
          : view.charAt(0).toUpperCase() + view.slice(1);
  function deleteEntry(log: Log) {
    if (
      update(
        (database) => ({
          ...database,
          logs: database.logs.filter((l) => l.id !== log.id),
        }),
        "Entry removed.",
      )
    ) {
      setUndo(log);
      setPopup(null);
    }
  }
  function undoDelete() {
    if (!undo) return;
    if (
      update(
        (database) => ({
          ...database,
          logs: database.logs.some((l) => l.id === undo.id)
            ? database.logs
            : [...database.logs, undo],
        }),
        "Entry restored.",
      )
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
              Made with peace of mind <ArrowRight size={13} />
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
          <span className="sidebar-version">
            A little care, all in one place.
          </span>
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
              {!ready
                ? "Getting ready…"
                : problem
                  ? "Storage needs attention"
                  : demo
                    ? "Preview mode"
                    : online
                      ? "Saved on this device"
                      : "You’re offline"}
            </span>
            <Link
              href="/settings/"
              className="icon-button"
              aria-label="Settings"
            >
              <Settings2 size={20} />
            </Link>
            <span className="care-avatar" aria-hidden="true">
              <Heart size={18} />
            </span>
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
              <div className="eyebrow">A LITTLE CARE, ALL IN ONE PLACE</div>
              <h1>
                {view === "overview" ? "Small moments. Better care." : title}
              </h1>
              <p>
                {view === "overview"
                  ? "A calmer way to care for your little ones."
                  : view === "medicines"
                    ? "Every dose remembered. One less thing on your mind."
                    : view === "symptoms"
                      ? "Notice the little things. Keep the whole picture."
                      : view === "history"
                        ? "Your care story, one moment at a time."
                        : view === "reports"
                          ? "A clear picture of care, ready to share."
                          : "A space that works for your family."}
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
              {view !== "settings" && (
                <div className="family-bar">
                  <div
                    className="child-switcher"
                    role="group"
                    aria-label="Choose a child"
                  >
                    {db.children.map((child) => (
                      <button
                        key={child.id}
                        className={`child-chip ${child.id === activeChild.id ? "selected" : ""}`}
                        aria-pressed={child.id === activeChild.id}
                        onClick={() =>
                          update((database) => ({
                            ...database,
                            settings: {
                              ...database.settings,
                              activeChildId: child.id,
                            },
                          }))
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={`child-initial ${child.color}`}
                        >
                          {child.name.charAt(0).toUpperCase()}
                        </span>
                        {child.name}
                      </button>
                    ))}
                    <button
                      className="add-child"
                      onClick={() => setPopup({ kind: "child" })}
                    >
                      <Plus size={16} />
                      Add child
                    </button>
                  </div>
                  <button
                    className="text-button profile-edit"
                    onClick={() =>
                      setPopup({ kind: "child", child: activeChild })
                    }
                  >
                    <Pencil size={14} />
                    Edit profile
                  </button>
                </div>
              )}
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
                <SymptomsView logs={logs} add={add} edit={edit} />
              )}
              {view === "history" && (
                <HistoryView logs={logs} edit={edit} add={add} />
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
                <Heart size={13} />
                Made for the people who care the most.
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
          key={popup.log?.id || `${popup.type}-${popup.name}`}
          kind={popup.type}
          name={popup.name}
          log={popup.log}
          childId={popup.log?.childId || activeChild.id}
          onClose={() => setPopup(null)}
          onDelete={(log) => setPopup({ kind: "delete-log", log })}
        />
      )}
      {popup?.kind === "child" && (
        <ChildForm
          child={popup.child}
          onClose={() => setPopup(null)}
          onDelete={(child) => setPopup({ kind: "delete-child", child })}
        />
      )}
      {popup?.kind === "delete-log" && (
        <Modal
          title="Remove this entry?"
          subtitle="You can undo this immediately after removing it."
          onClose={() => setPopup(null)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setPopup(null)}>
              Keep entry
            </button>
            <button
              className="button danger"
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
          onClose={() => setPopup(null)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setPopup(null)}>
              Keep profile
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (
                  update((database) => {
                    if (database.children.length < 2) return database;
                    const children = database.children.filter(
                      (c) => c.id !== popup.child.id,
                    );
                    return {
                      ...database,
                      children,
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
  const { db, now, demo, startDemo } = useCare();
  const today = todayLogs(logs, now);
  const medicines = today.filter((l) => l.type === "MEDICINE");
  const symptoms = today.filter((l) => l.type === "SYMPTOM");
  const temperature = logs.find((l) => l.data.temp);
  const birthday = child.birthday
    ? new Date(`${child.birthday}T12:00:00`)
    : null;
  const age = birthday
    ? new Date(now).getFullYear() -
      birthday.getFullYear() -
      (new Date(now).getMonth() < birthday.getMonth() ||
      (new Date(now).getMonth() === birthday.getMonth() &&
        new Date(now).getDate() < birthday.getDate())
        ? 1
        : 0)
    : null;
  return (
    <>
      <div className="welcome-card">
        <div>
          <span className="welcome-tag">
            <Heart size={13} />A LITTLE LOVE, A LITTLE LOG
          </span>
          <h2>
            {child.name === "Your child"
              ? "Their care, in good hands."
              : `${child.name}’s care, in good hands.`}
          </h2>
          <p>
            Medicines, symptoms, and all the in-between.
            <br />
            You take care of them. We’ll help with the remembering.
          </p>
          <button className="button primary" onClick={() => add("MEDICINE")}>
            <Plus size={17} />
            Log a medicine
          </button>
        </div>
        <Garden />
      </div>
      <div className="overview-label">
        <h2>
          Today at a glance{" "}
          <span>
            {child.name}
            {age !== null && age >= 0
              ? ` · ${age < 1 ? "Under 1" : age} ${age < 1 ? "year" : age === 1 ? "year" : "years"} old`
              : ""}
          </span>
        </h2>
        <span className="tiny-label">A little more peace of mind</span>
      </div>
      <div className="stats-grid">
        <Stat
          icon={Pill}
          color="sage"
          label="Medicines logged"
          value={String(medicines.length)}
          detail={
            medicines.length
              ? `Last at ${formatTime(medicines[0].timeGiven, db!.settings.timeFormat)}`
              : "A fresh start for today"
          }
        />
        <Stat
          icon={Thermometer}
          color="peach"
          label="Latest temperature"
          value={
            temperature
              ? `${convertTemperature(temperature.data.temp!, temperature.data.tempUnit || db!.settings.tempUnit, db!.settings.tempUnit)}°`
              : "—"
          }
          suffix={db!.settings.tempUnit}
          detail={
            temperature
              ? `${localDate(temperature.timeGiven) === localDate(now) ? "Today" : new Date(temperature.timeGiven).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${formatTime(temperature.timeGiven, db!.settings.timeFormat)}`
              : "No temperature recorded"
          }
        />
        <Stat
          icon={Activity}
          color="mint"
          label="Symptoms logged"
          value={String(symptoms.length)}
          detail={
            symptoms.length
              ? `${new Set(symptoms.map((l) => l.data.symptomName)).size} ${new Set(symptoms.map((l) => l.data.symptomName)).size === 1 ? "symptom" : "symptoms"} noted today`
              : "Nothing noted today"
          }
        />
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <TimerPanel logs={logs} />
          <section className="card activity-card">
            <SectionHeading
              title="Recent care"
              aside={
                <Link className="text-button" href="/history/">
                  View history <ArrowRight size={14} />
                </Link>
              }
            />
            {logs.length ? (
              <EntryList logs={logs.slice(0, 5)} onEdit={edit} compact />
            ) : (
              <EmptyState
                title="Every little moment matters."
                text="Log a medicine or symptom to start your child’s care story."
                action={
                  !demo ? (
                    <button className="text-button" onClick={startDemo}>
                      Explore an example <ArrowRight size={14} />
                    </button>
                  ) : undefined
                }
              />
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="card quick-log">
            <SectionHeading title="A quick little log" />
            <p className="section-description">
              What would you like to remember?
            </p>
            <button className="quick-action" onClick={() => add("MEDICINE")}>
              <IconBox icon={Pill} small />
              <span>
                <strong>Medicine</strong>
                <small>A dose, remembered</small>
              </span>
              <Plus size={17} />
            </button>
            <button className="quick-action" onClick={() => add("SYMPTOM")}>
              <IconBox icon={Thermometer} color="peach" small />
              <span>
                <strong>Symptom</strong>
                <small>The little things you notice</small>
              </span>
              <Plus size={17} />
            </button>
            <button
              className="quick-action"
              onClick={() => add("METRIC", "fluids")}
            >
              <IconBox icon={Droplets} color="mint" small />
              <span>
                <strong>Daily check-in</strong>
                <small>Meals, fluids & bathroom</small>
              </span>
              <Plus size={17} />
            </button>
          </section>
          <DailyChecks logs={logs} add={add} compact />
          <div className="gentle-note">
            <span className="gentle-heart">
              <Heart size={18} />
            </span>
            <p>
              You don’t have to remember
              <br />
              everything. Just be there.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function Stat({
  icon,
  color,
  label,
  value,
  detail,
  suffix,
}: {
  icon: typeof Pill;
  color: string;
  label: string;
  value: string;
  detail: string;
  suffix?: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <IconBox icon={icon} color={color} small />
      </div>
      <div className="stat-value">
        {value}
        <span>{suffix}</span>
      </div>
      <p>{detail}</p>
    </section>
  );
}

export function TimerPanel({ logs }: { logs: Log[] }) {
  const { db, now } = useCare();
  const timers = medicineTimers(logs, now);
  return (
    <section className="card timer-panel">
      <SectionHeading
        title="Medicine clocks"
        aside={
          <span className="pill-label">
            <Clock3 size={12} />A helping hand
          </span>
        }
      />
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

function MedicinesView({
  logs,
  add,
  edit,
}: {
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
  const { db, update } = useCare();
  const [showAll, setShowAll] = useState(false);
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
      <div className="medicine-grid">
        {(showAll ? all : all.slice(0, 4)).map((m) => (
          <div className="medicine-tile" key={m.name}>
            <button
              className="medicine-tile-main"
              onClick={() => add("MEDICINE", m.name)}
            >
              <IconBox icon={Pill} color={m.color} />
              <strong>{m.name}</strong>
              <span>{m.detail}</span>
              <span className="tile-action">
                Log a dose <Plus size={15} />
              </span>
            </button>
            {db!.customMedicines.includes(m.name) && (
              <button
                className="remove-shortcut icon-button"
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
          </div>
        ))}
        <button
          className="medicine-tile custom-tile"
          onClick={() => add("MEDICINE")}
        >
          <span className="custom-plus">
            <Plus size={25} strokeWidth={1.5} />
          </span>
          <strong>Something else?</strong>
          <span>Add your own medicine</span>
        </button>
      </div>
      {all.length > 4 && (
        <button
          className="text-button show-all"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show fewer medicines"
            : `Show all ${all.length} medicines`}
          <ListFilter size={14} />
        </button>
      )}
      <div className="medicines-lower">
        <TimerPanel logs={logs} />
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
  logs,
  add,
  edit,
}: {
  logs: Log[];
  add: EntryAction;
  edit: (log: Log) => void;
}) {
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
      <div className="symptom-grid">
        {SYMPTOMS.map((s, i) => (
          <button
            className="symptom-tile"
            key={s}
            onClick={() => add("SYMPTOM", s === "Other symptom" ? "" : s)}
          >
            <IconBox
              icon={
                s === "Fever"
                  ? Thermometer
                  : s === "Other symptom"
                    ? Plus
                    : Activity
              }
              color={["peach", "blue", "sage", "mint", "rose", "sage"][i]}
            />
            <strong>{s}</strong>
            <Plus size={15} />
          </button>
        ))}
      </div>
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
        aside={<span className="tiny-label">TODAY</span>}
      />
      <p className="section-description">How’s their day going?</p>
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
