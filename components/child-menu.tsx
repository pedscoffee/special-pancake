"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { useCare } from "./care-provider";
import type { Child } from "@/lib/types";

/** The active child's initial in the header; opens a panel to switch, add or edit. */
export function ChildMenu({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (child: Child) => void;
}) {
  const { db, update } = useCare();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const children = db?.children || [];
  const active =
    children.find((c) => c.id === db?.settings.activeChildId) || children[0];
  if (!active) return null;
  return (
    <div className="child-menu" ref={ref}>
      <button
        ref={buttonRef}
        className={`child-menu-button ${active.color}`}
        aria-label={`Switch child (current: ${active.name})`}
        aria-expanded={open}
        aria-controls="child-menu-panel"
        onClick={() => setOpen(!open)}
      >
        {active.name.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="child-menu-panel" id="child-menu-panel">
          <div role="group" aria-label="Choose a child">
            {children.map((child) => (
              <button
                key={child.id}
                className="child-menu-item"
                aria-pressed={child.id === active.id}
                onClick={async () => {
                  await update((database) => ({
                    ...database,
                    settings: {
                      ...database.settings,
                      activeChildId: child.id,
                    },
                  }));
                  setOpen(false);
                }}
              >
                <span
                  aria-hidden="true"
                  className={`child-initial ${child.color}`}
                >
                  {child.name.charAt(0).toUpperCase()}
                </span>
                {child.name}
                {child.id === active.id && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <div className="child-menu-actions">
            <button
              className="child-menu-item"
              onClick={() => {
                setOpen(false);
                onEdit(active);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              Edit profile
            </button>
            <button
              className="child-menu-item"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
            >
              <Plus size={15} aria-hidden="true" />
              Add child
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
