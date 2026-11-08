"use client";

// The composer's "Auto ▾" pill: where the next thing goes. Auto lets the words
// decide (lib/ask-route.ts); the menu can pin it to the calendar or a project
// for this one send. docs/design/TANGENT-STYLE.md §8 "Input with mic".

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, Check, ChevronDown, FolderPlus, Sparkles } from "lucide-react";

export type DestChoice = { dest: "calendar" } | { dest: "project"; projectId: string | "new" };

type Project = { id: string; title: string; color: string };

type Props = {
  choice: DestChoice | null;
  projects: Project[];
  onChange: (choice: DestChoice | null) => void;
  disabled?: boolean;
};

type Item = { key: string; label: string; choice: DestChoice | null; color?: string; icon?: "auto" | "calendar" | "new" };

function sameChoice(a: DestChoice | null, b: DestChoice | null): boolean {
  if (!a || !b) return a === b;
  if (a.dest !== b.dest) return false;
  return a.dest === "calendar" || a.projectId === (b as { projectId: string }).projectId;
}

export default function DestPill({ choice, projects, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = `dest-menu${useId().replace(/:/g, "")}`;

  const items: Item[] = [
    { key: "auto", label: "Auto", choice: null, icon: "auto" },
    { key: "calendar", label: "Calendar", choice: { dest: "calendar" }, icon: "calendar" },
    { key: "new", label: "New project", choice: { dest: "project", projectId: "new" }, icon: "new" },
    ...projects.map((p) => ({ key: p.id, label: p.title, choice: { dest: "project", projectId: p.id } as DestChoice, color: p.color })),
  ];
  const current = items.find((i) => sameChoice(i.choice, choice)) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    const at = Math.max(0, items.indexOf(current));
    window.requestAnimationFrame(() => itemRefs.current[at]?.focus());
    return () => document.removeEventListener("pointerdown", onPointer);
    // Focus the chosen item once, when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const pick = (item: Item) => {
    onChange(item.choice);
    close(true);
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((el) => el === document.activeElement);
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index >= last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index <= 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      close(false);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    itemRefs.current[next]?.focus();
  };

  return (
    <div className="add-pill-wrap" ref={root}>
      <button
        ref={button}
        type="button"
        className={`add-pill${choice ? " is-set" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Goes to: ${current.label}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {current.color && <span className="add-project-dot" style={{ background: current.color }} aria-hidden="true" />}
        <span className="add-pill-label">{current.label}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="add-pill-menu" role="menu" aria-label="Where it goes" onKeyDown={onMenuKey}>
          {items.map((item, i) => {
            const on = item === current;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                tabIndex={-1}
                className="add-pill-item"
                onClick={() => pick(item)}
              >
                <span className="add-pill-icon" aria-hidden="true">
                  {item.icon === "auto" && <Sparkles size={16} strokeWidth={1.75} />}
                  {item.icon === "calendar" && <CalendarDays size={16} strokeWidth={1.75} />}
                  {item.icon === "new" && <FolderPlus size={16} strokeWidth={1.75} />}
                  {item.color && <span className="add-project-dot" style={{ background: item.color }} />}
                </span>
                <span className="add-pill-item-label">{item.label}</span>
                {on && <Check size={16} strokeWidth={1.75} className="add-pill-check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
