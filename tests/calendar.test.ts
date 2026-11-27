import { test } from "node:test";
import assert from "node:assert/strict";
import { intervalAlertIcs } from "../lib/calendar";

test("calendar alert is always generic and fires at the interval end", () => {
  const ics = intervalAlertIcs({
    uid: "log-1",
    at: Date.UTC(2026, 10, 27, 1, 15),
    now: Date.UTC(2026, 10, 26, 19, 15),
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nDTSTART:20261127T011500Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261127T012000Z\r\n/);
  assert.match(ics, /\r\nTRIGGER:PT0M\r\n/);
  assert.match(ics, /\r\nSUMMARY:KiddyMeds reminder\r\n/);
  assert.match(ics, /\r\nDESCRIPTION:Open KiddyMeds to see your records.\r\n/);
  assert.doesNotMatch(ics, /dose|interval ends/i);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
