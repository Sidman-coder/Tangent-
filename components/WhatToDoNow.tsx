"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/AppStateProvider";
import type { Task } from "@/lib/types";
import { Zap, ArrowRight } from "lucide-react";

function formatDateTime(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const timeLabel = `${h12}:${String(m || 0).padStart(2, "0")} ${period}`;
  return `${dateLabel} · ${timeLabel}`;
}

function findMostUrgentTask(tasks: Task[]): Task | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const candidates = tasks.filter((t) => {
    if (t.completed) return false;
    const d = new Date(`${t.date}T00:00:00`);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  return candidates[0];
}

export function WhatToDoNow({ onViewTask }: { onViewTask?: (date: string) => void }) {
  const { state, loading, refresh } = useAppState();
  const router = useRouter();

  const urgentTask = useMemo(() => findMostUrgentTask(state?.tasks ?? []), [state]);

  const handleViewTask = (date: string) => {
    if (onViewTask) {
      onViewTask(date);
    } else {
      router.push(`/calendar?date=${date}`);
    }
  };

  const handleComplete = async (id: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_task", id }),
    });
    await refresh();
  };

  if (loading && !state) {
    return (
      <div className="wtdn-wrap">
        <div className="wtdn-skeleton" aria-hidden />
      </div>
    );
  }

  if (!urgentTask) {
    return (
      <div className="wtdn-wrap">
        <div className="wtdn-empty">
          <p className="wtdn-empty-title">You&apos;re all caught up this month.</p>
          <p className="wtdn-empty-sub">Add a new task to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wtdn-wrap">
      <div className="wtdn-card surface-record">
        <div className="wtdn-label"><Zap size={18} strokeWidth={1.75} /> What To Do Now</div>
        <div className="wtdn-top">
          <h3 className="wtdn-title">{urgentTask.title}</h3>
          <span className="wtdn-datetime">{formatDateTime(urgentTask.date, urgentTask.time)}</span>
        </div>
        {urgentTask.startAction && (
          <>
            <div className="wtdn-divider" />
            <div className="wtdn-action-row">
              <span className="wtdn-arrow"><ArrowRight size={16} strokeWidth={1.75} /></span>
              <span className="wtdn-action-text">{urgentTask.startAction}</span>
            </div>
          </>
        )}
        <div className="wtdn-actions">
          <button type="button" className="btn-ghost surface-action-secondary" onClick={() => handleViewTask(urgentTask.date)}>
            View Task
          </button>
          <button type="button" className="btn surface-action-primary" onClick={() => void handleComplete(urgentTask.id)}>
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}
