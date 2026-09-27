"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

// A top-bar warning that appears only when the deployment has no shared
// database, i.e. /api/health reports it isn't durable. In that state every
// save lands on whichever server instance answered, so paths, tasks and
// Canvas imports seem to vanish after leaving and coming back. Saying so
// beats losing someone's work silently.
export default function StorageStatus() {
  const [durable, setDurable] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { durable?: boolean }) => setDurable(d.durable !== false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (durable) return null;

  return (
    <div className="storage-status" ref={ref}>
      <button type="button" className="storage-status-pill" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
        <span>Not saving</span>
      </button>
      {open && (
        <div className="storage-status-pop" role="dialog" aria-label="Storage is not set up">
          <strong>Changes won&rsquo;t stick yet</strong>
          <p>
            This site has no database connected, so paths, tasks and Canvas imports are kept on a temporary
            server and can disappear when you leave.
          </p>
          <p className="storage-status-fix">
            To fix it in Vercel: <b>Storage</b> → <b>Upstash Redis</b> (free) → connect it to this project → redeploy.
          </p>
        </div>
      )}
    </div>
  );
}
