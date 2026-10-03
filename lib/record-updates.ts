import type { Database, Log, MedicineFavorite } from "./types";
import { recordSignature } from "./sharing";

export function assertUnchangedLog(db: Database, original: Log) {
  const latest = db.logs.find((log) => log.id === original.id);
  if (
    !latest ||
    latest.childId !== original.childId ||
    recordSignature(latest) !== recordSignature(original)
  )
    throw new Error(
      "This entry changed in another tab. Your form is still here; reopen the latest entry before making changes.",
    );
}

export function saveCareRecord(
  db: Database,
  entry: Log,
  original?: Log,
): Database {
  if (!db.children.some((child) => child.id === entry.childId))
    throw new Error(
      "This child profile was removed in another tab. Your entry couldn’t be saved.",
    );
  if (original) assertUnchangedLog(db, original);
  else if (db.logs.some((log) => log.id === entry.id))
    throw new Error("This entry has already been saved.");
  return {
    ...db,
    logs: original
      ? db.logs.map((log) => (log.id === entry.id ? entry : log))
      : [...db.logs, entry],
  };
}

export function saveMedicineFavorite(
  db: Database,
  favorite: MedicineFavorite,
): Database {
  const favorites = db.medicineFavorites || [];
  const existing = favorites.find(
    (item) =>
      item.childId === favorite.childId &&
      item.name.toLowerCase() === favorite.name.toLowerCase(),
  );
  const next = { ...favorite, id: existing?.id || favorite.id };
  return {
    ...db,
    medicineFavorites: existing
      ? favorites.map((item) => (item.id === existing.id ? next : item))
      : [...favorites, next],
  };
}
