import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDatabase, parseDatabase } from "../lib/care";
import { saveCareRecord, saveMedicineFavorite } from "../lib/record-updates";
import { makeCareShare } from "../lib/sharing";
import type { Log, MedicineFavorite } from "../lib/types";

function fixture() {
  const db = emptyDatabase();
  db.children = [
    { id: "ella", name: "Ella", color: "sage" },
    { id: "oliver", name: "Oliver", color: "mint" },
  ];
  const favorite: MedicineFavorite = {
    id: "favorite",
    childId: "ella",
    name: "Family medicine",
    dosage: "Caregiver-entered details",
    frequencyHours: 6,
  };
  const log: Log = {
    id: "dose",
    childId: "ella",
    type: "MEDICINE",
    timeGiven: Date.now(),
    timestamp: Date.now(),
    data: { medicineName: favorite.name, dosage: favorite.dosage },
  };
  return { db, favorite, log };
}

test("favorites round-trip backups, stay child-specific, and update the same shortcut", () => {
  const { db, favorite } = fixture();
  const first = saveMedicineFavorite(db, favorite);
  const updated = saveMedicineFavorite(first, {
    ...favorite,
    id: "different",
    name: "FAMILY MEDICINE",
    dosage: "Reviewed details",
  });
  const both = saveMedicineFavorite(updated, {
    ...favorite,
    id: "oliver-favorite",
    childId: "oliver",
  });
  const restored = parseDatabase(JSON.parse(JSON.stringify(both)));
  assert.equal(restored.medicineFavorites?.length, 2);
  assert.equal(restored.medicineFavorites?.[0].id, favorite.id);
  assert.equal(restored.medicineFavorites?.[0].dosage, "Reviewed details");
  assert.equal(restored.medicineFavorites?.[1].childId, "oliver");
  assert.equal(db.medicineFavorites, undefined);
});

test("invalid, duplicate, and unlinked favorites cannot be restored", () => {
  const { db, favorite } = fixture();
  for (const invalid of [
    { ...favorite, childId: "missing" },
    { ...favorite, name: " " },
    { ...favorite, frequencyHours: 0 },
    { ...favorite, frequencyHours: Infinity },
    { ...favorite, dosage: 5 },
    { ...favorite, id: "" },
  ])
    assert.throws(
      () => parseDatabase({ ...db, medicineFavorites: [invalid] }),
      /favorite/,
    );
  assert.throws(
    () =>
      parseDatabase({
        ...db,
        medicineFavorites: [favorite, { ...favorite, id: "other" }],
      }),
    /duplicate/,
  );
  assert.throws(
    () =>
      parseDatabase({
        ...db,
        medicineFavorites: [favorite, { ...favorite, childId: "oliver" }],
      }),
    /favorite/,
  );
});

test("care shares exclude private medicine favorites", () => {
  const { db, favorite, log } = fixture();
  const saved = saveMedicineFavorite(saveCareRecord(db, log), favorite);
  const share = makeCareShare(saved, "ella", "", "");
  assert.equal("medicineFavorites" in share, false);
  assert.equal("medicineFavorites" in share.child, false);
  assert.equal(share.logs.length, 1);
});

test("a stale edit or removed record cannot overwrite a newer version", () => {
  const { db, log } = fixture();
  const first = saveCareRecord(db, log);
  const latest = saveCareRecord(
    first,
    { ...log, data: { ...log.data, notes: "Newer version" } },
    log,
  );
  assert.throws(
    () =>
      saveCareRecord(
        latest,
        { ...log, data: { ...log.data, notes: "Old edit" } },
        log,
      ),
    /changed in another tab/,
  );
  assert.throws(() => saveCareRecord(db, log, log), /changed in another tab/);
  assert.equal(latest.logs[0].data.notes, "Newer version");
});

test("a removed child and repeated entry IDs cannot create unlinked or duplicate records", () => {
  const { db, log } = fixture();
  const latest = saveCareRecord(db, log);
  assert.throws(() => saveCareRecord(latest, log), /already been saved/);
  assert.throws(
    () => saveCareRecord({ ...db, children: db.children.slice(1) }, log),
    /profile was removed/,
  );
});
