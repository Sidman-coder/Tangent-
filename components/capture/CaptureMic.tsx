"use client";

// The round mic on a phone, once you've left capture mode: tap goes back to
// it, press and hold goes back already listening. The route change loses the
// press, so that listening ends with a tap (CaptureHome's ?capture=1).

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;

export default function CaptureMic() {
  const router = useRouter();
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <button
      type="button"
      className="float-mic capture-mic-float lg lg-interactive"
      aria-label="Back to capture. Press and hold to start talking."
      onPointerDown={(e) => {
        clear();
        held.current = false;
        const timer = window.setTimeout(() => {
          held.current = true;
          press.current = null;
          router.push("/capture?capture=1");
        }, LONG_PRESS_MS);
        press.current = { timer, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > MOVE_CANCEL_PX) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // The click that ends a long press isn't a tap.
        if (held.current) {
          held.current = false;
          return;
        }
        router.push("/capture");
      }}
    >
      <Mic size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
