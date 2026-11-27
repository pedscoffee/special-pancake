"use client";

import { Check } from "lucide-react";
import { useCare } from "./care-provider";
import {
  formatTime,
  localDate,
  NOT_SEEN_METRIC,
  NOT_SEEN_OPTIONS,
} from "@/lib/care";
import type { Log } from "@/lib/types";

/**
 * One-tap "checked, not seen" records for the symptoms doctors ask about.
 * A pressed chip means a "not seen" check exists today; tapping it again
 * removes today's check for that symptom.
 */
export function QuickNegatives({
  childId,
  logs,
}: {
  childId: string;
  logs: Log[];
}) {
  const { db, now, update, saving } = useCare();
  const today = localDate(now);
  const checkedToday = (symptom: string) =>
    logs
      .filter(
        (l) =>
          l.type === "METRIC" &&
          l.data.metricType === NOT_SEEN_METRIC &&
          l.data.value === symptom &&
          localDate(l.timeGiven) === today,
      )
      .sort((a, b) => b.timeGiven - a.timeGiven);
  async function toggle(symptom: string, time: number) {
    const existing = checkedToday(symptom);
    if (existing.length) {
      const ids = new Set(existing.map((l) => l.id));
      await update(
        (database) => ({
          ...database,
          logs: database.logs.filter((l) => !ids.has(l.id)),
        }),
        `Removed “No ${symptom.toLowerCase()}” for today.`,
      );
      return;
    }
    await update(
      (database) => ({
        ...database,
        logs: [
          ...database.logs,
          {
            id: crypto.randomUUID(),
            childId,
            type: "METRIC",
            timeGiven: time,
            timestamp: time,
            data: { metricType: NOT_SEEN_METRIC, value: symptom, notes: "" },
          },
        ],
      }),
      `Noted: no ${symptom.toLowerCase()}. Tap again to undo.`,
    );
  }
  return (
    <section className="card quick-negatives" aria-labelledby="not-seen-title">
      <div>
        <h2 id="not-seen-title">Checked, not seen today</h2>
        <p className="section-description">
          One tap records that you looked and didn’t see it. Doctors find “no
          rash” as useful as “rash.”
        </p>
      </div>
      <div className="not-seen-options">
        {NOT_SEEN_OPTIONS.map((symptom) => {
          const latest = checkedToday(symptom)[0];
          return (
            <button
              key={symptom}
              className={`not-seen-chip ${latest ? "checked" : ""}`}
              aria-pressed={!!latest}
              disabled={saving}
              onClick={() => toggle(symptom, Date.now())}
            >
              {latest && <Check size={15} aria-hidden="true" />}
              No {symptom.toLowerCase()}
              {latest && (
                <small>
                  {formatTime(latest.timeGiven, db?.settings.timeFormat)}
                </small>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
