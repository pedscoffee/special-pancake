"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  Clock3,
  Heart,
  Pill,
  Utensils,
  Droplets,
  Bath,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Log } from "@/lib/types";
import { formatTime, logDetail, logTitle, relativeTime } from "@/lib/care";
import { useCare } from "./care-provider";
import { symptomAppearance } from "./symptom-icons";

export function IconBox({
  icon: Icon,
  color = "sage",
  small = false,
}: {
  icon: LucideIcon;
  color?: string;
  small?: boolean;
}) {
  return (
    <span className={`icon-box ${color} ${small ? "small" : ""}`}>
      <Icon size={small ? 19 : 23} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`modal ${className}`.trim()}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function EmptyState({
  title = "A fresh start for a little one.",
  text = "Your care records will appear here as you go.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-illustration">
        <Heart size={30} strokeWidth={1.4} />
        <span className="sparkle one">✦</span>
        <span className="sparkle two">✧</span>
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function EntryList({
  logs,
  onEdit,
  compact = false,
}: {
  logs: Log[];
  onEdit: (log: Log) => void;
  compact?: boolean;
}) {
  const { db, now } = useCare();
  return (
    <div className={`entry-list ${compact ? "compact" : ""}`}>
      {logs.map((log) => {
        const symptom = symptomAppearance(log.data.symptomName);
        const Icon =
          log.type === "MEDICINE"
            ? Pill
            : log.type === "SYMPTOM"
              ? symptom.icon
              : log.data.metricType === "appetite"
                ? Utensils
                : log.data.metricType === "fluids" ||
                    log.data.metricType === "urine"
                  ? Droplets
                  : Bath;
        const color =
          log.type === "MEDICINE"
            ? "sage"
            : log.type === "SYMPTOM"
              ? symptom.color
              : "mint";
        return (
          <button
            className="entry-row"
            key={log.id}
            onClick={() => onEdit(log)}
            aria-label={`Edit ${logTitle(log)} at ${formatTime(log.timeGiven, db?.settings.timeFormat)}`}
          >
            <IconBox icon={Icon} color={color} small />
            <span className="entry-copy">
              <strong>{logTitle(log)}</strong>
              <span>{logDetail(log, db?.settings.tempUnit)}</span>
            </span>
            <span className="entry-time">
              <strong>
                {formatTime(log.timeGiven, db?.settings.timeFormat)}
              </strong>
              <span>{relativeTime(log.timeGiven, now)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
export function SectionHeading({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {aside}
    </div>
  );
}
export function ClockNote({ children }: { children: ReactNode }) {
  return (
    <p className="clock-note">
      <Clock3 size={14} />
      {children}
    </p>
  );
}
