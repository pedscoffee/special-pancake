"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2 } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { localDate } from "@/lib/care";
import { makeCareShare } from "@/lib/sharing";
import { encodeHandoff, handoffUrl, QR_MAX_LENGTH } from "@/lib/handoff";
import { findOnset } from "@/lib/visit-summary";
import type { Child, Log } from "@/lib/types";

type Range = "illness" | "day" | "three";

/** Send a care snapshot to another caregiver as a link or QR code. */
export function HandoffSheet({
  child,
  logs,
  onClose,
}: {
  child: Child;
  logs: Log[];
  onClose: () => void;
}) {
  const { db, now, notify } = useCare();
  const illness = findOnset(logs, now, now);
  const [range, setRange] = useState<Range>(illness ? "illness" : "day");
  const [link, setLink] = useState<{ url: string; qr: string | null } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);

  const since =
    range === "illness" && illness
      ? new Date(`${localDate(illness.start)}T00:00:00`).getTime()
      : now - (range === "three" ? 3 : 1) * 86400000;
  const included = logs.filter((l) => l.timeGiven >= since);
  const count = included.length;

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!db || !count) return;
      try {
        const share = makeCareShare(db, child.id, "", "", "all", Date.now());
        const ids = new Set(included.map((l) => l.id));
        const payload = await encodeHandoff({
          ...share,
          from: localDate(since),
          logs: share.logs.filter((l) => ids.has(l.id)),
        });
        const url = handoffUrl(window.location.origin, payload);
        const qr =
          url.length <= QR_MAX_LENGTH
            ? await QRCode.toDataURL(url, {
                errorCorrectionLevel: "L",
                margin: 2,
                width: 560,
                color: { dark: "#1c2421", light: "#ffffff" },
              })
            : null;
        if (!cancelled) setLink({ url, qr });
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "The link couldn’t be made.",
          );
      }
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setLink(null);
        setError("");
      }
      build();
    });
    return () => {
      cancelled = true;
    };
    // `included` follows from range and logs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, child.id, range, logs, count]);

  async function share() {
    if (!link) return;
    try {
      await navigator.share({
        title: "A care update from KiddyMeds",
        url: link.url,
      });
    } catch {
      /* Cancelled; the sheet stays open. */
    }
  }
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      notify("Link copied. Send it in a private message.");
    } catch {
      setCopyFallback(true);
    }
  }
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const ranges: { value: Range; label: string }[] = [
    ...(illness ? [{ value: "illness" as const, label: "This illness" }] : []),
    { value: "day", label: "Last 24 hours" },
    { value: "three", label: "Last 3 days" },
  ];
  return (
    <Modal
      title={`Hand off ${child.name}’s care`}
      subtitle="For another caregiver. Notes are left out."
      onClose={onClose}
    >
      <div className="handoff-sheet">
        <div className="segmented" role="group" aria-label="What to include">
          {ranges.map((r) => (
            <button
              key={r.value}
              aria-pressed={range === r.value}
              className={range === r.value ? "selected" : ""}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          <strong>
            {count} {count === 1 ? "entry" : "entries"}
          </strong>{" "}
          · notes left out
        </p>
        {!count ? (
          <p className="inline-note">Nothing recorded in this period yet.</p>
        ) : error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : !link ? (
          <p className="field-hint" aria-live="polite">
            Making the link…
          </p>
        ) : (
          <>
            {link.qr ? (
              <figure className="handoff-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={link.qr}
                  width={240}
                  height={240}
                  alt="QR code for the hand-off link"
                />
                <figcaption>
                  Hold this up for the other caregiver to scan with their
                  camera.
                </figcaption>
              </figure>
            ) : (
              <p className="inline-note">
                This is too much for a QR code. The link still works. Send it in
                a private message.
              </p>
            )}
            <div className="handoff-actions">
              {canShare && (
                <button className="button primary" onClick={share}>
                  <Share2 size={16} />
                  Share link
                </button>
              )}
              <button
                className={`button ${canShare ? "secondary" : "primary"}`}
                onClick={copy}
              >
                <Copy size={16} />
                Copy link
              </button>
            </div>
            {copyFallback && (
              <textarea
                className="report-text"
                readOnly
                value={link.url}
                aria-label="Hand-off link to copy"
                onFocus={(e) => e.currentTarget.select()}
                autoFocus
              />
            )}
          </>
        )}
        <div className="handoff-warning" role="note">
          <strong>
            Anyone with this link or code can see {child.name}’s care.
          </strong>
          <span>
            Send it only to people caring for {child.name}, in a private
            message. Don’t post it or forward it. It’s a snapshot of these
            entries and won’t update.
          </span>
        </div>
      </div>
    </Modal>
  );
}
