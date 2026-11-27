/**
 * A single calendar event (.ics) with an alert when a recorded interval ends.
 * Built on the device; the phone's own calendar app sounds the alert. The
 * wording reports the interval the caregiver entered and never suggests a dose.
 */
export type IntervalAlert = {
  uid: string;
  at: number;
  childName: string;
  medicineName: string;
  intervalHours: number;
  /** Calendars sync to the cloud and show on lock screens, so details are opt-in. */
  includeDetails: boolean;
  now?: number;
};

function stamp(time: number) {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
function escapeText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
/** Fold lines longer than 75 octets, as iCalendar requires. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length ? 74 : 75;
    if (new TextEncoder().encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function alertTitle(alert: IntervalAlert) {
  return alert.includeDetails
    ? `${alert.childName}: recorded ${alert.medicineName} interval ends`
    : "KiddyMeds reminder";
}

export function intervalAlertIcs(alert: IntervalAlert) {
  const title = alertTitle(alert);
  const description = alert.includeDetails
    ? `The ${alert.intervalHours}-hour interval you recorded in KiddyMeds for ${alert.medicineName} ends now. This is not a dosing instruction; follow your healthcare provider’s directions.`
    : "Open KiddyMeds to see your records.";
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
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
