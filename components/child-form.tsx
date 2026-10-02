"use client";
import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { COLORS, localDate } from "@/lib/care";
import type { Child } from "@/lib/types";
import { useCare } from "./care-provider";
import { Modal } from "./ui";

export function ChildForm({
  child,
  onClose,
  onDelete,
}: {
  child?: Child;
  onClose: () => void;
  onDelete: (child: Child) => void;
}) {
  const { db, update, now } = useCare();
  const [color, setColor] = useState(
    child?.color || COLORS[(db?.children.length || 0) % COLORS.length],
  );
  const [error, setError] = useState("");
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setError("Add a first name or nickname for your child.");
      return;
    }
    const profile: Child = {
      id: child?.id || crypto.randomUUID(),
      name,
      color,
      birthday: String(form.get("birthday") || "") || undefined,
    };
    if (
      update(
        (database) => ({
          ...database,
          children: child
            ? database.children.map((c) => (c.id === child.id ? profile : c))
            : [...database.children, profile],
          settings: { ...database.settings, activeChildId: profile.id },
        }),
        child ? "Profile updated." : `${name} is part of the family.`,
      )
    )
      onClose();
  }
  return (
    <Modal
      title={child ? "Edit child profile" : "Add a little one"}
      subtitle="Their own space. Their own care story."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={save}>
        <label>
          First name or nickname
          <input
            name="name"
            defaultValue={child?.name}
            required
            autoFocus
            maxLength={100}
            placeholder="e.g. Ella"
          />
        </label>
        <label>
          Birthday <span className="optional">optional</span>
          <input
            name="birthday"
            type="date"
            max={localDate(now)}
            defaultValue={child?.birthday}
          />
          <span className="field-hint">
            Only used to show their age. Stored on this device.
          </span>
        </label>
        <fieldset className="color-picker">
          <legend>Pick their color</legend>
          <div>
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${c} ${c === color ? "selected" : ""}`}
                aria-label={c}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              >
                {c === color && <Check size={20} />}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {child && (db?.children.length || 0) > 1 ? (
            <button
              className="button danger-ghost"
              type="button"
              onClick={() => onDelete(child)}
            >
              <Trash2 size={16} />
              Remove child
            </button>
          ) : (
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button className="button primary" type="submit">
            {child ? <Check size={17} /> : <Plus size={17} />}
            {child ? "Save profile" : "Add child"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
