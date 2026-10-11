import { NextResponse } from "next/server";
import {
  getAllChatSessions,
  createChatSession,
  getChatSession,
  addChatSessionMessage,
  attachChatMessageRefs,
  replaceLastAssistantMessage,
  renameChatSession,
  deleteChatSession,
  linkChatSession,
  styleChatSession,
} from "@/lib/store";
import { withUser } from "@/lib/request-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrUndefined = (v: unknown): string | undefined => (typeof v === "string" && UUID.test(v) ? v : undefined);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (sessionId) {
    const session = await getChatSession(sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    return NextResponse.json({ ok: true, session });
  }
  return NextResponse.json({ ok: true, sessions: await getAllChatSessions() });
});

export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as {
      action?: string;
      sessionId?: string;
      title?: string;
      role?: string;
      content?: string;
      /** replace_last_assistant: the saved text to swap out. */
      from?: string;
      actionId?: string;
      /** add_message / attach: the change set an assistant message previewed. */
      changeSetId?: string;
      taskIds?: string[];
      planId?: string | null;
      color?: string | null;
      pinned?: boolean;
    };
    const { action } = body;

    if (action === "create") {
      const session = await createChatSession(body.title);
      return NextResponse.json({ ok: true, session });
    }

    if (action === "add_message") {
      const { sessionId, role, content } = body;
      if (!sessionId || !role || !content?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing sessionId, role, or content" }, { status: 400 });
      }
      const msg = await addChatSessionMessage(sessionId, role as "user" | "assistant", content.trim(), {
        actionId: uuidOrUndefined(body.actionId),
        changeSetId: uuidOrUndefined(body.changeSetId),
      });
      if (!msg) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, message: msg });
    }

    // Undo after reload: remember which change an earlier assistant message made.
    // `from` matches by text (a plan drafted from the chat); otherwise by change set.
    if (action === "attach") {
      const { sessionId } = body;
      const refs = { actionId: uuidOrUndefined(body.actionId), changeSetId: uuidOrUndefined(body.changeSetId) };
      if (!sessionId || (!refs.actionId && !refs.changeSetId)) {
        return NextResponse.json({ ok: false, error: "Missing sessionId or ids" }, { status: 400 });
      }
      const match = body.from?.trim() ? { content: body.from.trim() } : { changeSetId: refs.changeSetId };
      const attached = await attachChatMessageRefs(sessionId, match, refs);
      return NextResponse.json({ ok: true, attached });
    }

    if (action === "replace_last_assistant") {
      const { sessionId, from, content } = body;
      if (!sessionId || !from?.trim() || !content?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing sessionId, from, or content" }, { status: 400 });
      }
      const replaced = await replaceLastAssistantMessage(sessionId, from.trim(), content.trim());
      return NextResponse.json({ ok: true, replaced });
    }

    if (action === "rename") {
      const { sessionId, title } = body;
      if (!sessionId || !title?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing sessionId or title" }, { status: 400 });
      }
      await renameChatSession(sessionId, title);
      return NextResponse.json({ ok: true });
    }

    if (action === "link") {
      const { sessionId, actionId, taskIds, planId } = body;
      if (!sessionId || (!actionId && !taskIds?.length && !planId)) {
        return NextResponse.json({ ok: false, error: "Missing sessionId or link target" }, { status: 400 });
      }
      const session = await linkChatSession(sessionId, { actionId, taskIds, planId });
      if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, session });
    }

    if (action === "style") {
      const { sessionId, color, pinned } = body;
      if (!sessionId) return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
      if (color !== undefined && color !== null && !/^#[0-9a-f]{6}$/i.test(color)) {
        return NextResponse.json({ ok: false, error: "Color must be a #rrggbb hex" }, { status: 400 });
      }
      const session = await styleChatSession(sessionId, { color, pinned });
      if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      return NextResponse.json({ ok: true, session });
    }

    if (action === "delete") {
      const { sessionId } = body;
      if (!sessionId) return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
      await deleteChatSession(sessionId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
