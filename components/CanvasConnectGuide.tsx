"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Link2, X } from "lucide-react";
import Button from "@/components/ui/Button";

const STEPS = [
  {
    title: "Open Calendar in Canvas",
    instruction: "In Canvas, open Calendar from the main navigation. Switch to Month view so the Calendar Feed link is easy to find.",
    image: "/guides/canvas-calendar.png",
    alt: "Canvas Calendar month view with the Calendar Feed link visible on the right",
  },
  {
    title: "Select Calendar Feed",
    instruction: "Find Calendar Feed beneath the calendar list on the right side, then select it to open your personal feed link.",
    image: "/guides/canvas-calendar.png",
    alt: "Canvas Calendar showing the Calendar Feed action in the right sidebar",
  },
  {
    title: "Copy your feed link",
    instruction: "Copy the complete link shown in the Calendar Feed window, then paste it below. Tangent will use it to bring assignments into your calendar.",
    image: "/guides/canvas-feed.png",
    alt: "Canvas Calendar Feed dialog showing the personal calendar feed URL",
  },
] as const;

type ConnectStatus = "idle" | "loading" | "success" | "error";

export default function CanvasConnectGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [icsUrl, setIcsUrl] = useState("");
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setIcsUrl("");
    setStatus("idle");
    setError("");
  }, [open]);

  const connect = async () => {
    const value = icsUrl.trim();
    if (!value) {
      setStatus("error");
      setError("Paste your Canvas calendar feed link before connecting.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: value }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Canvas could not be connected. Check the link and try again.");
      setStatus("success");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Canvas could not be connected. Check the link and try again.");
    }
  };

  if (!open) return null;
  const current = STEPS[step];
  const isFinalStep = step === STEPS.length - 1;

  return (
    <div className="canvas-guide-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && status !== "loading") onClose();
    }}>
      <div
        ref={dialogRef}
        className="canvas-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-guide-title"
        tabIndex={-1}
      >
        <header className="canvas-guide-header">
          <div className="canvas-guide-heading">
            <span className="canvas-guide-icon" aria-hidden="true"><CalendarDays size={18} /></span>
            <div>
              <h2 id="canvas-guide-title">Connect Canvas</h2>
              <p>Bring assignments into Tangent with your calendar feed.</p>
            </div>
          </div>
          <button type="button" className="canvas-guide-close" onClick={onClose} aria-label="Close Canvas guide" disabled={status === "loading"}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {status === "success" ? (
          <div className="canvas-guide-success" role="status">
            <span aria-hidden="true"><CheckCircle2 size={28} /></span>
            <h3>Canvas connected</h3>
            <p>Connected — your assignments will appear on your calendar.</p>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="canvas-guide-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((item, index) => <span key={item.title} className={index <= step ? "is-complete" : ""} />)}
            </div>

            <div className="canvas-guide-body">
              <div className="canvas-guide-copy">
                <span>Step {step + 1} of {STEPS.length}</span>
                <h3>{current.title}</h3>
                <p>{current.instruction}</p>
              </div>
              <div className="canvas-guide-image-wrap">
                <Image src={current.image} alt={current.alt} width={1920} height={1000} priority sizes="(max-width: 720px) 92vw, 820px" />
              </div>

              {isFinalStep && (
                <label className="canvas-guide-field">
                  <span>Paste your calendar feed link here</span>
                  <div className="canvas-guide-input-row">
                    <Link2 size={17} aria-hidden="true" />
                    <input
                      type="url"
                      value={icsUrl}
                      onChange={(event) => { setIcsUrl(event.target.value); if (status === "error") setStatus("idle"); }}
                      placeholder="https://canvas.instructure.com/feeds/calendars/user_…"
                      autoComplete="off"
                    />
                  </div>
                </label>
              )}
              {status === "error" && <p className="canvas-guide-error" role="alert">{error}</p>}
            </div>

            <footer className="canvas-guide-footer">
              <Button variant="quiet" onClick={() => step === 0 ? onClose() : setStep((value) => value - 1)} icon={step > 0 ? <ChevronLeft size={16} /> : undefined} disabled={status === "loading"}>
                {step === 0 ? "Cancel" : "Back"}
              </Button>
              {isFinalStep ? (
                <Button variant="primary" onClick={() => void connect()} loading={status === "loading"} loadingLabel="Connecting…">Connect</Button>
              ) : (
                <Button variant="primary" onClick={() => setStep((value) => value + 1)}>Next <ChevronRight size={16} /></Button>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
