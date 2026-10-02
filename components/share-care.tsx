"use client";

import { useState } from "react";
import { Copy, Download, Mail, Share2 } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { downloadFile } from "@/lib/download";
import {
  careFileName,
  careFileText,
  careShareMessage,
  makeCareShare,
} from "@/lib/sharing";

export function ShareCare({
  childId,
  from,
  to,
  type,
  onClose,
}: {
  childId: string;
  from: string;
  to: string;
  type: string;
  onClose: () => void;
}) {
  const { db, notify, demo } = useCare();
  const [sharedAt] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [includeFile, setIncludeFile] = useState(true);
  if (!db) return null;
  let share;
  try {
    share = makeCareShare(db, childId, from, to, type, sharedAt);
  } catch (err) {
    return (
      <Modal title="Share care" onClose={onClose}>
        <p className="form-error" role="alert">
          {err instanceof Error
            ? err.message
            : "Choose a valid period with at least one record."}
        </p>
      </Modal>
    );
  }
  const summary = careShareMessage(share, db.settings, note);
  const fileText = careFileText(
    share,
    db.settings,
    `${window.location.origin}/`,
    note,
  );
  const filename = careFileName(share);
  const file = new File([fileText], filename, { type: "text/plain" });
  let fileSharing = false;
  try {
    fileSharing = !!navigator.canShare?.({ files: [file] });
  } catch {
    /* Keep copy and download available. */
  }
  const nativeShare = typeof navigator.share === "function";
  const subject = `${share.child.name}’s care update · KiddyMeds`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setStatus("Message copied. Paste it into a text or email.");
    } catch {
      setCopyFallback(true);
      setStatus("Select and copy the message below.");
    }
  }
  function download() {
    downloadFile(fileText, filename);
    setStatus(
      "Care file downloaded. Attach it to your message so the recipient can import the full records.",
    );
  }
  async function sendToShareSheet() {
    setBusy(true);
    setStatus("");
    try {
      const attach = includeFile && fileSharing;
      await navigator.share({
        title: subject,
        text: summary,
        ...(attach ? { files: [file] } : {}),
      });
      setStatus(
        attach
          ? "Handed to your device’s sharing options. The selected app controls sending."
          : "Summary handed to your device’s sharing options. Download the care file separately if you want to attach records.",
      );
      notify("Share options opened.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError")
        setStatus("Sharing canceled. Your records haven’t changed.");
      else
        setStatus(
          "Sharing wasn’t available. You can copy the message, open an email draft, or download the care file below.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Share a little care"
      subtitle={`${share.child.name} · ${share.logs.length} selected ${share.logs.length === 1 ? "record" : "records"}`}
      onClose={onClose}
    >
      <div className="form-stack">
        <p className="field-hint">
          Only this child’s records in the selected report period and category
          are included. This sends a snapshot; later changes won’t sync.
        </p>
        {demo && (
          <p className="inline-note">You’re sharing sample demo records.</p>
        )}
        <label>
          Personal message <span className="optional">optional</span>
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Here’s today’s care before your turn."
          />
        </label>
        <details
          className="share-preview"
          open={copyFallback ? true : undefined}
        >
          <summary>Message preview</summary>
          {copyFallback ? (
            <textarea
              readOnly
              value={summary}
              aria-label="Share message to copy"
              rows={9}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : (
            <pre tabIndex={0} role="region" aria-label="Share message preview">
              {summary}
            </pre>
          )}
        </details>
        {nativeShare && fileSharing && (
          <label className="share-checkbox">
            <input
              type="checkbox"
              checked={includeFile}
              onChange={(e) => setIncludeFile(e.target.checked)}
            />
            Include the care file so they can import these records.
          </label>
        )}
        {(!nativeShare || !fileSharing) && (
          <p className="field-hint">
            To include importable records, download the care file and attach it
            to your text or email. The message alone is a readable summary.
          </p>
        )}
        {nativeShare && (
          <button
            className="button primary"
            disabled={busy}
            onClick={sendToShareSheet}
          >
            <Share2 size={16} />
            {busy
              ? "Opening share options…"
              : includeFile && fileSharing
                ? "Share message & care file"
                : "Share message"}
          </button>
        )}
        <div className="share-actions">
          <button
            className={`button ${nativeShare ? "secondary" : "primary"}`}
            onClick={copy}
          >
            <Copy size={16} />
            Copy message
          </button>
          <a
            className="button secondary"
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`}
          >
            <Mail size={16} />
            Email draft
          </a>
          <button className="button secondary" onClick={download}>
            <Download size={16} />
            Download care file
          </button>
        </div>
        <p className="field-hint">
          Email drafts include the message. Attach the downloaded care file
          yourself to include importable records.
        </p>
        <p className="field-hint">
          The care file is readable on its own. To import it, the recipient
          opens KiddyMeds → Reports → Receive care and selects the file.
        </p>
        {status && (
          <p className="inline-note" role="status">
            {status}
          </p>
        )}
      </div>
    </Modal>
  );
}
