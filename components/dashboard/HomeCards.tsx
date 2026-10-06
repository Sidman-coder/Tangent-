"use client";

// The small, calm cards onboarding adds to Home: the student's starting point,
// an optional Canvas nudge, and a Paths card for goal-minded students. At most
// one of the first two shows at a time, and each goes away for good once used
// or dismissed.

import "./home-cards.css";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { ArrowRight, CalendarPlus, ListChecks, Route, X } from "lucide-react";
import Button from "@/components/ui/Button";
import CanvasConnectGuide from "@/components/CanvasConnectGuide";
import { OPEN_PALETTE_EVENT, type OpenPaletteDetail } from "@/hooks/useVoiceCapture";
import { riseIn } from "@/lib/motion";
import { putNewPathTitle } from "@/lib/path-handoff";
import { pathsStarterCopy, type Prefs } from "@/lib/personalize";
import type { Path } from "@/lib/types";

async function clearStartingIntent(): Promise<void> {
  await fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startingIntent: null }),
  }).catch(() => null);
}

export function StartingIntentCard({ intent, onCleared }: { intent: string; onCleared: () => void }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const done = () => {
    setGone(true);
    void clearStartingIntent().then(onCleared);
  };

  // Prefills capture; the student still reads it and presses send.
  const breakDown = () => {
    window.dispatchEvent(
      new CustomEvent<OpenPaletteDetail>(OPEN_PALETTE_EVENT, { detail: { prefill: `Break this into steps: ${intent}` } })
    );
    done();
  };

  const makePath = () => {
    putNewPathTitle(intent);
    done();
    router.push("/tangents?new=1");
  };

  return (
    <m.section variants={riseIn} className="home-card home-intent" aria-labelledby="home-intent-title">
      <div className="home-card-head">
        <p id="home-intent-title" className="home-card-eyebrow">Your starting point</p>
        <button type="button" className="home-card-close" onClick={done} aria-label="Dismiss your starting point">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <p className="home-intent-text">“{intent}”</p>
      <div className="home-card-actions">
        <Button variant="secondary" size="sm" onClick={breakDown} icon={<ListChecks size={15} aria-hidden="true" />}>
          Break it into steps
        </Button>
        <Button variant="secondary" size="sm" onClick={makePath} icon={<Route size={15} aria-hidden="true" />}>
          Make it a Path
        </Button>
      </div>
    </m.section>
  );
}

function canvasDismissKey(email: string): string {
  return `tangent-canvas-card-dismissed:${email.trim().toLowerCase()}`;
}

/** "Use Canvas?" for students who finished the new onboarding and haven't
 *  connected it. "Not now" is remembered per student on this device; Canvas
 *  stays one click away in Settings. */
export function CanvasCard({ email }: { email: string }) {
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(canvasDismissKey(email)) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    let cancelled = false;
    fetch("/api/canvas/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; feed?: unknown }) => {
        if (!cancelled && data.ok && !data.feed) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [email]);

  const notNow = () => {
    try {
      window.localStorage.setItem(canvasDismissKey(email), "1");
    } catch {
      /* storage blocked: it just comes back next visit */
    }
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <m.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="home-card home-canvas" aria-labelledby="home-canvas-title">
          <div className="home-canvas-icon" aria-hidden="true">
            <CalendarPlus size={18} />
          </div>
          <div className="home-canvas-copy">
            <h2 id="home-canvas-title">Use Canvas?</h2>
            <p>Bring your deadlines into Tangent.</p>
          </div>
          <div className="home-card-actions">
            <Button variant="quiet" size="sm" onClick={notNow}>
              Not now
            </Button>
            <Button variant="primary" size="sm" onClick={() => setGuideOpen(true)}>
              Connect Canvas
            </Button>
          </div>
        </m.section>
      )}
      <CanvasConnectGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          // Re-check: once connected, the card has done its job.
          fetch("/api/canvas/status", { cache: "no-store" })
            .then((r) => r.json())
            .then((data: { ok?: boolean; feed?: unknown }) => {
              if (data.ok && data.feed) setVisible(false);
            })
            .catch(() => undefined);
        }}
      />
    </>
  );
}

type PathSummary = Path & { counts?: { work: number; ideas: number; kept: number; done: number } };

/** For students whose answers point at bigger goals: their most recent Path
 *  with its progress, or a starter when they have none. */
export function PathsCard({ prefs }: { prefs: Prefs }) {
  const router = useRouter();
  const [paths, setPaths] = useState<PathSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/path", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { paths?: PathSummary[] }) => {
        if (!cancelled) setPaths(Array.isArray(data.paths) ? data.paths : []);
      })
      .catch(() => !cancelled && setPaths([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (paths === null) return null;

  if (paths.length === 0) {
    const copy = pathsStarterCopy(prefs);
    return (
      <m.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="home-card home-paths" aria-labelledby="home-paths-title">
        <div className="home-paths-copy">
          <p className="home-card-eyebrow">Paths</p>
          <h2 id="home-paths-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => router.push("/tangents?new=1")} icon={<Route size={15} aria-hidden="true" />}>
          {copy.cta}
        </Button>
      </m.section>
    );
  }

  const latest = [...paths].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const kept = latest.counts?.kept ?? 0;
  const done = latest.counts?.done ?? 0;
  const pct = kept > 0 ? Math.round((done / kept) * 100) : 0;
  return (
    <m.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="home-card home-paths" aria-labelledby="home-paths-title">
      <div className="home-paths-copy">
        <p className="home-card-eyebrow">Your path{paths.length > 1 ? "s" : ""}</p>
        <h2 id="home-paths-title">{latest.title}</h2>
        <p>
          {kept > 0 ? `${done} of ${kept} steps done` : "No steps kept yet"}
          {paths.length > 1 && ` · ${paths.length - 1} more path${paths.length > 2 ? "s" : ""}`}
        </p>
        {kept > 0 && (
          <div className="home-paths-bar" role="progressbar" aria-label={`${latest.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={() => router.push(`/tangents/${latest.id}`)}>
        Open <ArrowRight size={14} aria-hidden="true" />
      </Button>
    </m.section>
  );
}
