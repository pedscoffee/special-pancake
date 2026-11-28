import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeHandoff,
  encodeHandoff,
  QR_MAX_LENGTH,
  handoffUrl,
  readPastedCare,
} from "../lib/handoff";
import {
  careFileText,
  makeCareShare,
  mergeCareShare,
  planCareMerge,
  recordSignature,
} from "../lib/sharing";
import { demoDatabase } from "../lib/care";

const now = new Date("2026-11-26T19:40:00").getTime();

test("a hand-off round-trips without notes and stays QR-sized for a short illness", async () => {
  const db = demoDatabase(now);
  const childId = db.children[0].id;
  const share = makeCareShare(db, childId, "", "", "all", now);
  assert.ok(share.logs.some((l) => l.data.notes));
  const payload = await encodeHandoff(share);
  assert.match(payload, /^c1\.[A-Za-z0-9_-]+$/);
  assert.ok(
    handoffUrl("https://kiddymeds.example", payload).length <= QR_MAX_LENGTH,
    `payload ${payload.length} chars`,
  );
  const received = await decodeHandoff(`#${payload}`);
  assert.equal(received.notesOmitted, true);
  assert.equal(received.child.name, share.child.name);
  assert.equal(received.logs.length, share.logs.length);
  assert.ok(received.logs.every((l) => !l.data.notes));
  assert.deepEqual(
    received.logs.map((l) => [l.id, l.type, l.timeGiven, l.data.medicineName]),
    share.logs.map((l) => [l.id, l.type, l.timeGiven, l.data.medicineName]),
  );
});

test("damaged or foreign links are refused with a clear message", async () => {
  await assert.rejects(
    decodeHandoff("#hello"),
    /doesn’t contain a KiddyMeds hand-off/,
  );
  await assert.rejects(
    decodeHandoff("#c1.not-really-compressed"),
    /incomplete or damaged/,
  );
});

test("receiving your own entries back without notes is a duplicate, and keeps your notes", async () => {
  const db = demoDatabase(now);
  const childId = db.children[0].id;
  const received = await decodeHandoff(
    await encodeHandoff(makeCareShare(db, childId, "", "", "all", now)),
  );
  const plan = planCareMerge(db, received, childId);
  assert.equal(plan.added.length, 0);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.duplicates.length, received.logs.length);

  // An entry edited on the other phone still differs, and choosing it keeps local notes.
  const local = db.logs.find((l) => l.data.notes)!;
  const edited = {
    ...received,
    logs: received.logs.map((l) =>
      l.id === local.id ? { ...l, timeGiven: l.timeGiven - 60000 } : l,
    ),
  };
  const conflicts = planCareMerge(db, edited, childId).conflicts;
  assert.equal(conflicts.length, 1);
  const merged = mergeCareShare(db, edited, childId, {
    [local.id]: {
      keep: "incoming",
      localSignature: recordSignature(local),
    },
  });
  const after = merged.logs.find((l) => l.id === local.id)!;
  assert.equal(after.timeGiven, local.timeGiven - 60000);
  assert.ok(local.data.notes);
  assert.equal(after.data.notes, local.data.notes);
});

test("a pasted hand-off link opens even with message text, wrapping or a missing https://", async () => {
  const db = demoDatabase(now);
  const share = makeCareShare(db, db.children[0].id, "", "", "all", now);
  const url = handoffUrl(
    "https://kiddymeds.example",
    await encodeHandoff(share),
  );
  const wrapped = `Here’s Ella’s update: ${url.replace("https://", "").slice(0, 60)}\n${url.slice(60 + 8)} thanks!`;
  for (const text of [url, `  ${url}\n`, wrapped]) {
    const received = await readPastedCare(text);
    assert.equal(received.child.id, share.child.id);
    assert.equal(received.logs.length, share.logs.length);
  }
  // A care file's text works too.
  const file = await readPastedCare(
    careFileText(share, db.settings, "https://kiddymeds.example/"),
  );
  assert.equal(file.logs.length, share.logs.length);
  await assert.rejects(readPastedCare("hello"), /hand-off link/);
  await assert.rejects(readPastedCare("   "), /Paste/);
  await assert.rejects(readPastedCare(`${url.slice(0, -20)}`), /damaged/);
});
