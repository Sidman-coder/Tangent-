"use client";

// Home's general chat: an "Ask anything" bar that opens Ask Tangent over the
// day. Links land here too: /?ask=1 (Cmd-K or AddFlow handed over words),
// /?chat=<id> (a general chat from the library), /?taskChat=<id>.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Library, MessageSquareText } from "lucide-react";
import ChatSheet from "./ChatSheet";
import { openTaskChat } from "./TaskChatSheet";
import { takeAsk } from "@/lib/ask-handoff";
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

  const close = () => {
    setOpen(false);
    setOpenId(null);
    setAskOnOpen(null);
  };

  return (
    <>
      <div className="home-ask-row">
        <button type="button" className="home-ask" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <MessageSquareText size={18} aria-hidden="true" />
          <span className="home-ask-label">Ask Tangent anything…</span>
        </button>
        <Link className="home-ask-link" href="/ai" aria-label="All chats">
          <Library size={18} aria-hidden="true" />
        </Link>
      </div>
      <ChatSheet open={open} scope={{ type: "general" }} openId={openId} askOnOpen={askOnOpen} label="Ask Tangent" onClose={close} />
    </>
  );
}
