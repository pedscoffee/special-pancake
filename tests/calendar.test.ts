import { test } from "node:test";
import assert from "node:assert/strict";
import { intervalAlertIcs } from "../lib/calendar";

const base = {
  uid: "log-1",
  at: Date.UTC(2026, 10, 27, 1, 15),
  childName: "Ella",
  medicineName: "Motrin, children's",
  intervalHours: 6,
  now: Date.UTC(2026, 10, 26, 19, 15),
};

test("calendar alert is generic by default and fires at the interval end", () => {
  const ics = intervalAlertIcs({ ...base, includeDetails: false });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nDTSTART:20261127T011500Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261127T012000Z\r\n/);
  assert.match(ics, /\r\nTRIGGER:PT0M\r\n/);
  assert.match(ics, /SUMMARY:KiddyMeds reminder/);
  assert.doesNotMatch(ics, /Ella|Motrin/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("details are escaped, folded, and never phrased as a dose being due", () => {
  const ics = intervalAlertIcs({ ...base, includeDetails: true });
  assert.match(
    ics,
    /SUMMARY:Ella: recorded Motrin\\, children's interval ends/,
  );
  assert.doesNotMatch(ics, /dose due|next dose|safe to give/i);
  for (const line of ics.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
});
