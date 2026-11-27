"use client";

import { useState } from "react";
import { CalendarPlus, Download, Share2 } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { formatTime } from "@/lib/care";
import { ALERT_TITLE, intervalAlertIcs } from "@/lib/calendar";
import { downloadFile } from "@/lib/download";
import type { Log } from "@/lib/types";

/** Opens the calendar-alert dialog for one medicine clock. */
export function CalendarAlertButton({
  log,
  target,
}: {
  log: Log;
  target: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="text-button calendar-alert-button"
        onClick={() => setOpen(true)}
        aria-label={`Add a calendar alert for the end of the recorded ${log.data.medicineName} interval`}
      >
        <CalendarPlus size={14} />
        Calendar alert
      </button>
      {open && (
        <CalendarAlertDialog
          log={log}
          target={target}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function CalendarAlertDialog({
  log,
  target,
  onClose,
}: {
  log: Log;
  target: number;
  onClose: () => void;
}) {
  const { db, notify } = useCare();
  const ics = intervalAlertIcs({ uid: `${log.id}-${target}`, at: target });
  const file =
    typeof File !== "undefined"
      ? new File([ics], "kiddymeds-reminder.ics", { type: "text/calendar" })
      : null;
  const canShare =
    !!file &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [file] });
  const when = `${new Date(target).toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(target, db?.settings.timeFormat)}`;
  return (
    <Modal
      title="Add a calendar alert"
      subtitle={`Your calendar alerts you at ${when}, when the ${log.data.frequencyHours}-hour interval you recorded ends.`}
      onClose={onClose}
    >
      <div className="form-stack">
        <p className="field-hint">
          The event is titled <strong>{ALERT_TITLE}</strong> and never includes
          your child’s name, the medicine, or any care details, so it’s safe on
          a lock screen or a shared calendar.
        </p>
        <p className="field-hint">
          The event won’t change if you edit or remove this entry later. Share
          it to send the same alert to another caregiver. It’s a reminder of
          your recorded interval, not a dosing instruction.
        </p>
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => {
              downloadFile(
                ics,
                "kiddymeds-reminder.ics",
                "text/calendar;charset=utf-8",
              );
              notify("Calendar event downloaded. Open it to add the alert.");
              onClose();
            }}
          >
            <Download size={16} />
            Download event
          </button>
          {canShare && (
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await navigator.share({ files: [file!], title: "Reminder" });
                  onClose();
                } catch {
                  /* Sharing was cancelled; the dialog stays open. */
                }
              }}
            >
              <Share2 size={16} />
              Share or add
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
