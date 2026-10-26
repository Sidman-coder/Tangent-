"use client";

import { useParams } from "next/navigation";
import PathView from "@/components/path/PathView";

// A path on its own page: what links from tasks, the calendar and Today open.
// Inside the app, a path is opened from its project (Projects → View path).
export default function PathPage() {
  const params = useParams<{ pathId: string }>();
  if (!params?.pathId) return null;
  return <PathView pathId={params.pathId} />;
}
