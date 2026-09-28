import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppState, getPathSpace } from "@/lib/store";
import { withUser } from "@/lib/request-context";

// Identifies THIS process, not this deployment. Module scope runs once per
// cold start, so this id is stable within an instance and different across
// instances.
const INSTANCE_ID = randomUUID().slice(0, 8);

export const dynamic = "force-dynamic";

// Tells the top bar (components/StorageStatus.tsx) whether saves are durable.
// All data lives in Supabase (Postgres, scoped per student by RLS), so the
// answer is yes whenever Supabase is configured; the counts are the signed-in
// student's own and read back from the database, so every instance agrees.
export const GET = withUser(async () => {
  const [state, space] = await Promise.all([getAppState(), getPathSpace()]);
  const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json({
    ok: true,
    storage: "supabase",
    shared: supabase,
    durable: supabase,
    instance: INSTANCE_ID,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    counts: {
      tasks: state.tasks.length,
      plans: state.plans.length,
      paths: space.paths.length,
      pathNodes: space.nodes.length,
    },
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});
