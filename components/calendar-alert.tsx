"use client";

import { useState } from "react";
import { CalendarPlus, Download, Share2 } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { formatTime } from "@/lib/care";
import { alertTitle, intervalAlertIcs } from "@/lib/calendar";
import { downloadFile } from "@/lib/download";
import type { Log } from "@/lib/types";

/** Opens the calendar-alert dialog for one medicine clock. */
export function CalendarAlertButton({
  log,
  target,
  childName,
}: {
  log: Log;
  target: number;
  childName: string;
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
          childName={childName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CalendarAlertDialog({
  log,
  target,
  childName,
  onClose,
}: {
  log: Log;
  target: number;
  childName: string;
  onClose: () => void;
}) {
  const { db, notify } = useCare();
  const [details, setDetails] = useState(false);
  const alert = {
    uid: `${log.id}-${target}`,
    at: target,
    childName,
    medicineName: log.data.medicineName || "medicine",
    intervalHours: log.data.frequencyHours || 0,
    includeDetails: details,
  };
  const ics = intervalAlertIcs(alert);
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
        <label className="favorite-checkbox">
          <input
            type="checkbox"
            checked={details}
            onChange={(e) => setDetails(e.target.checked)}
          />
          Show {childName}’s name and the medicine in the event
        </label>
        <p className="field-hint">
          Event title: <strong>{alertTitle(alert)}</strong>. Calendars can sync
          to the cloud and show on your lock screen, so details are off unless
          you choose them.
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
