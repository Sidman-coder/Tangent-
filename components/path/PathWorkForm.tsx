"use client";

import { useState } from "react";
import { m } from "motion/react";
import type { AnchorKind } from "@/lib/types";

// Adding something by hand: a piece of work on the root circle, or your own
// branch under an idea. Same form either way; the parent decides which it
// becomes, on the server, so the client never has to reason about depth.

type Payload = {
  title: string;
  detail?: string;
  category?: AnchorKind;
  hoursPerWeek?: number;
  years?: number;
};

type Props = {
  parentId: string | null;
  onCancel: () => void;
  onSubmit: (payload: Payload) => Promise<boolean>;
};

const CATEGORIES: { value: AnchorKind; label: string }[] = [
  { value: "ec", label: "Activity" },
  { value: "award", label: "Award" },
  { value: "course", label: "Course" },
  { value: "project", label: "Project" },
];

export default function PathWorkForm({ parentId, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [category, setCategory] = useState<AnchorKind>("ec");
  const [hours, setHours] = useState("");
  const [years, setYears] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("Give it a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const ok = await onSubmit({
      title: title.trim(),
      detail: detail.trim() || undefined,
      category,
      hoursPerWeek: hours ? Number(hours) : undefined,
      years: years ? Number(years) : undefined,
    });
    setSubmitting(false);
    if (!ok) setError("That didn't save. Try again.");
  };

  return (
    <m.div
      className="path-form"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", visualDuration: 0.3, bounce: 0.14 }}
      role="dialog"
      aria-label={parentId ? "Add your own branch" : "Add work to the circle"}
    >
      <h2>{parentId ? "Your own branch" : "Something you already do"}</h2>

      <label className="path-form-wide">
        <span>What is it?</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="FRC Robotics"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          autoFocus
        />
      </label>

      <label className="path-form-wide">
        <span>Your role or the result</span>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Programming lead, two seasons"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
      </label>

      {!parentId && (
        <>
          <label>
            <span>Kind</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as AnchorKind)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Hours a week</span>
            <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="6" inputMode="numeric" />
          </label>
          <label>
            <span>Years</span>
            <input value={years} onChange={(e) => setYears(e.target.value)} placeholder="2" inputMode="numeric" />
          </label>
        </>
      )}

      {error && (
        <p className="path-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="path-form-actions">
        <button type="button" className="path-btn is-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="path-btn is-primary" onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Adding" : "Add"}
        </button>
      </div>
    </m.div>
  );
}
