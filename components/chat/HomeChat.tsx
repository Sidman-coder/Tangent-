"use client";

// Home's general chat sheet. Nothing shows until a link opens it: /?ask=1
// (the composer or Cmd-K handed over a question), /?chat=<id> (a general chat
// from the library), /?taskChat=<id>.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatSheet from "./ChatSheet";
import { openTaskChat } from "./TaskChatSheet";
import { ASK_EVENT, takeAsk } from "@/lib/ask-handoff";
import "./chat-sheet.css";

export default function HomeChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [askOnOpen, setAskOnOpen] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chat = params.get("chat");
    const taskChat = params.get("taskChat");
    const ask = params.get("ask");
    if (!chat && !taskChat && !ask) return;
    if (taskChat) openTaskChat(taskChat);
    else if (chat) {
      setOpenId(chat);
      setOpen(true);
    } else {
      setAskOnOpen(takeAsk("ai"));
      setOpen(true);
    }
    router.replace("/", { scroll: false });
  }, [router]);

  // Asked from this page (the composer or Cmd-K): open in place.
  useEffect(() => {
    const onAsk = (event: Event) => {
      event.preventDefault();
      setOpenId(null);
      setAskOnOpen(takeAsk("ai"));
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  const close = () => {
    setOpen(false);
    setOpenId(null);
    setAskOnOpen(null);
  };

  return (
    <ChatSheet open={open} scope={{ type: "general" }} openId={openId} askOnOpen={askOnOpen} label="Ask Tangent" onClose={close} />
  );
}
