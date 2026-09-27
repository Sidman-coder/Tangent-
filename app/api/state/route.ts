import { NextResponse } from "next/server";
import { z } from "zod";
import { getState, replaceState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

// PUT replaces the caller's entire workspace, so a malformed body used to be a
// way to wipe or corrupt it: the handler cast straight to AppState and handed
// it to the store, and `{}` was a valid-looking replacement. This checks the
// shape first. It is deliberately shallow — the top-level collections have to
// exist and be the right type, and the objects inside stay loose so a client
// running slightly ahead of the server is not rejected over an added field.
const taskShape = z
  .object({
    id: z.string(),
    title: z.string(),
    date: z.string(),
    time: z.string(),
    completed: z.boolean(),
  })
  .loose();

const stateShape = z
  .object({
    tasks: z.array(taskShape),
    calendars: z.array(z.object({ id: z.string() }).loose()),
    events: z.array(z.looseObject({})),
    user: z.looseObject({}),
    weeklyPlan: z.array(z.string()),
    lastVoiceCommand: z.string().nullable(),
    lastVoiceResponse: z.string().nullable(),
    plans: z.array(z.object({ id: z.string() }).loose()),
  })
  .loose();

async function GETHandler() {
  return NextResponse.json(getState());
}

async function PUTHandler(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = stateShape.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: `Not a valid workspace: ${first ? `${first.path.join(".") || "(root)"} ${first.message.toLowerCase()}` : "unrecognised shape"}.`,
      },
      { status: 400 }
    );
  }

  replaceState(parsed.data as unknown as AppState);
  return NextResponse.json({ ok: true, state: getState() });
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const GET = withWorkspaceRoute(GETHandler);
export const PUT = withWorkspaceRoute(PUTHandler);
