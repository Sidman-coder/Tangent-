"use client";

// Round 5B Phase 3: "Tell Tangent something" at the bottom of "You, mapped".
// A wide pastel pill with mic and send; what Tangent says back sits in a
// small thread above it. Whatever it keeps shows up on the map (the parent
// makes those lights glow).

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import VoiceRecordButton from "@/components/VoiceRecordButton";

type Turn = { id: number; who: "you" | "tangent"; text: string };

export default function KnowsTell({ onTell }: { onTell: (text: string) => Promise<string> }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voiceNote, setVoiceNote] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);

  // The field grows with what you type, up to about four lines.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    setVoiceNote("");
    setTurns((t) => [...t, { id: ++seq.current, who: "you" as const, text }].slice(-8));
    const reply = await onTell(text).catch(() => "Couldn't save that. Try again.");
    setTurns((t) => [...t, { id: ++seq.current, who: "tangent" as const, text: reply }].slice(-8));
    setBusy(false);
    box.current?.focus();
  };

  return (
    <div className="knows-tell">
      {turns.length > 0 && (
        <ol className="knows-tell-thread" aria-live="polite" aria-label="What you told Tangent">
          {turns.map((t) => (
            <li key={t.id} className={`knows-tell-turn is-${t.who}`}>
              {t.who === "tangent" && <span className="knows-tell-who">Tangent</span>}
              <p>{t.text}</p>
            </li>
          ))}
          {busy && (
            <li className="knows-tell-turn is-tangent is-typing" aria-label="Tangent is thinking">
              <span className="knows-tell-dots" aria-hidden="true"><i /><i /><i /></span>
            </li>
          )}
        </ol>
      )}
      <form
        className="knows-tell-pill"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <VoiceRecordButton
          className="ui-icon-button ui-icon-button--ghost knows-tell-mic"
          onTranscript={(text) => setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text))}
          onError={(m) => setVoiceNote(m)}
          disabled={busy}
        />
        <textarea
          ref={box}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Tell Tangent something about you"
          aria-label="Tell Tangent something"
          maxLength={600}
        />
        <button type="submit" className="knows-tell-send" disabled={busy || !draft.trim()} aria-label="Send">
          <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </form>
      {voiceNote && <p className="knows-tell-note" role="status">{voiceNote}</p>}
    </div>
  );
}
