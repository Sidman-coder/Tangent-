"use client";

// The one chat thread for a task, opened from anywhere ("Ask about this" in a
// task, the library, a project's step). Mounted once in the app layout and
// opened with openTaskChat(taskId).

import { useEffect, useState } from "react";
import ChatSheet from "./ChatSheet";
import { useAppState } from "@/components/AppStateProvider";

export const OPEN_TASK_CHAT_EVENT = "tangent:open-task-chat";

export function openTaskChat(taskId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_TASK_CHAT_EVENT, { detail: taskId }));
}

export default function TaskChatSheet() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const { state } = useAppState();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string" && id) setTaskId(id);
    };
    window.addEventListener(OPEN_TASK_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TASK_CHAT_EVENT, onOpen);
  }, []);

  const title = state?.tasks.find((t) => t.id === taskId)?.title;
  return (
    <ChatSheet
      open={taskId !== null}
      scope={taskId ? { type: "task", taskId } : { type: "general" }}
      label={title ? `Chat about ${title}` : "Task chat"}
      onClose={() => setTaskId(null)}
    />
  );
}
