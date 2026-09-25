import { NextResponse } from "next/server";
import {
  getAllChatSessions,
  createChatSession,
  getChatSession,
  addChatSessionMessage,
  renameChatSession,
  deleteChatSession,
  linkChatSession,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (sessionId) {
    const session = getChatSession(sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    return NextResponse.json({ ok: true, session });
  }
  return NextResponse.json({ ok: true, sessions: getAllChatSessions() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      sessionId?: string;
      title?: string;
      role?: string;
      content?: string;
      actionId?: string;
      taskIds?: string[];
      planId?: string | null;
    };
    const { action } = body;

    if (action === "create") {
      const session = createChatSession(body.title);
      return NextResponse.json({ ok: true, session });
    }

    if (action === "add_message") {
      const { sessionId, role, content } = body;
      if (!sessionId || !role || !content?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing sessionId, role, or content" }, { status: 400 });
      }
      const msg = addChatSessionMessage(sessionId, role as "user" | "assistant", content.trim());
      if (!msg) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, message: msg });
    }

    if (action === "rename") {
      const { sessionId, title } = body;
      if (!sessionId || !title?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing sessionId or title" }, { status: 400 });
      }
      renameChatSession(sessionId, title);
      return NextResponse.json({ ok: true });
    }

    if (action === "link") {
      const { sessionId, actionId, taskIds, planId } = body;
      if (!sessionId || (!actionId && !taskIds?.length && !planId)) {
        return NextResponse.json({ ok: false, error: "Missing sessionId or link target" }, { status: 400 });
      }
      const session = linkChatSession(sessionId, { actionId, taskIds, planId });
      if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, session });
    }

    if (action === "delete") {
      const { sessionId } = body;
      if (!sessionId) return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
      deleteChatSession(sessionId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
