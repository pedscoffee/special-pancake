"use client";

import { useState } from "react";
import { useCare } from "./care-provider";
import type { Child } from "@/lib/types";
import {
  childAge,
  type SummaryRow,
  type VisitSummary,
} from "@/lib/visit-summary";

const STATUS_TEXT: Record<SummaryRow["status"], string> = {
  noticed: "Noticed",
  none: "Checked, not seen",
  usual: "Usual",
  "not-recorded": "Not recorded",
};

/** Option A: one row per question asked at almost every sick visit. */
export function VisitSummaryCard({
  child,
  summary,
}: {
  child: Child;
  summary: VisitSummary;
}) {
  const { now, update, saving } = useCare();
  const [questions, setQuestions] = useState(child.visitQuestions || "");
  const [savedQuestions, setSavedQuestions] = useState(
    child.visitQuestions || "",
  );
  if ((child.visitQuestions || "") !== savedQuestions) {
    // Another tab or a restore changed them; show the stored version.
    setSavedQuestions(child.visitQuestions || "");
    setQuestions(child.visitQuestions || "");
  }
  const age = childAge(child, now);
  async function saveQuestions() {
    const text = questions.slice(0, 2000);
    if (text === (child.visitQuestions || "")) return;
    await update(
      (db) => ({
        ...db,
        children: db.children.map((c) => {
          if (c.id !== child.id) return c;
          const next = { ...c };
          if (text.trim()) next.visitQuestions = text;
          else delete next.visitQuestions;
          return next;
        }),
      }),
      "Questions saved.",
    );
  }
  return (
    <div className="visit-summary">
      <div className="visit-summary-top">
        <span className="eyebrow">FOR THE DOCTOR</span>
        <span className="visit-updated">
          Updated{" "}
          {new Date(now).toLocaleString("en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      <h2>
        {child.name}
        {age ? `, ${age}` : ""}
      </h2>
      <p className={`visit-onset ${summary.onset ? "" : "unmarked"}`}>
        {summary.onset
          ? summary.onset.label
          : "Illness start not marked. Use “Got sick” on the overview."}
      </p>
      {!summary.rows.length && !summary.others.length && (
        <p className="visit-empty">
          Nothing recorded in these dates yet. Symptoms, check-ins and “not
          seen” checks will show here.
        </p>
      )}
      <dl
        className="visit-rows"
        hidden={!summary.rows.length && !summary.others.length}
      >
        {summary.rows.map((row) => (
          <div key={row.key} className={`visit-row ${row.status}`}>
            <dt>{row.label}</dt>
            <dd>
              <strong>
                <span className="sr-only">{STATUS_TEXT[row.status]}: </span>
                {row.primary}
              </strong>
              {row.secondary && <span>{row.secondary}</span>}
            </dd>
          </div>
        ))}
        {summary.others.length > 0 && (
          <div className="visit-row noticed">
            <dt>Also noted</dt>
            <dd>
              <strong>{summary.others.join("; ")}</strong>
            </dd>
          </div>
        )}
      </dl>
      <h3 className="visit-subhead">WHAT WE TRIED</h3>
      {summary.tried.length ? (
        <ul className="visit-tried">
          {summary.tried.map((item) => (
            <li key={item.name.toLowerCase()}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.days}</small>
              </span>
              <span className={`response-chip ${item.responseKind}`}>
                {item.response}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="visit-empty">No medicines recorded in these dates.</p>
      )}
      <h3 className="visit-subhead">
        <label htmlFor={`questions-${child.id}`}>OUR QUESTIONS</label>
      </h3>
      <textarea
        id={`questions-${child.id}`}
        className="visit-questions screen-only"
        rows={3}
        maxLength={2000}
        value={questions}
        disabled={saving}
        placeholder="Write down what you’d like to ask at the visit…"
        onChange={(e) => setQuestions(e.target.value)}
        onBlur={saveQuestions}
      />
      {questions.trim() && (
        <p className="visit-questions-print print-only">{questions}</p>
      )}
      <p className="visit-legend">
        <span className="noticed">Rust = noticed</span>
        <span className="none">None = checked, not seen</span>
      </p>
      <p className="visit-disclaimer">
        Parent-recorded observations from KiddyMeds. Not medical advice.
      </p>
    </div>
  );
}
