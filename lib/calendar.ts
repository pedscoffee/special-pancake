/**
 * A single calendar event (.ics) with an alert when a recorded interval ends.
 * Built on the device; the phone's own calendar app sounds the alert.
 */
export type IntervalAlert = {
  uid: string;
  at: number;
  now?: number;
};

/**
 * Always generic. Calendars sync to the cloud, show on lock screens and get
 * shared, so the event never names the child, the medicine, or KiddyMeds data.
 */
export const ALERT_TITLE = "KiddyMeds reminder";
const ALERT_DESCRIPTION = "Open KiddyMeds to see your records.";

function stamp(time: number) {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function intervalAlertIcs(alert: IntervalAlert) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KiddyMeds//Interval alert//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${alert.uid}@kiddymeds`,
    `DTSTAMP:${stamp(alert.now ?? Date.now())}`,
    `DTSTART:${stamp(alert.at)}`,
    // A distinct end time; iOS may refuse events that start and end together.
    `DTEND:${stamp(alert.at + 5 * 60000)}`,
    `SUMMARY:${ALERT_TITLE}`,
    `DESCRIPTION:${ALERT_DESCRIPTION}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${ALERT_TITLE}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
