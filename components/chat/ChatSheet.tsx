"use client";

// A chat that opens over the page it's about: a right-hand panel on a laptop,
// full screen on a phone. Home, a task and a project each open one; the page
// underneath stays where it was. ChatPanel does the talking.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChatPanel from "./ChatPanel";
import type { ChatScope } from "@/lib/chat/scope";
import "./chat-sheet.css";

export type ChatSheetProps = {
  open: boolean;
  scope: ChatScope;
  /** A general chat to reopen (from the library). */
  openId?: string | null;
  /** Words handed over from Cmd-K or AddFlow, asked as soon as it opens. */
  askOnOpen?: string | null;
  label: string;
  onClose: () => void;
};

export default function ChatSheet({ open, scope, openId = null, askOnOpen = null, label, onClose }: ChatSheetProps) {
  const [mounted, setMounted] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = before;
      returnFocus.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="chat-sheet-root">
      <button type="button" className="chat-sheet-backdrop" aria-label="Close chat" tabIndex={-1} onClick={onClose} />
      <section className="chat-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <ChatPanel scope={scope} openId={openId} askOnOpen={askOnOpen} onDone={onClose} />
      </section>
    </div>,
    document.body
  );
}
