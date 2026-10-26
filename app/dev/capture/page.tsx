"use client";

// Development-only preview of the capture home with sample data, so its
// motion can be looked at and profiled locally without a Supabase account.
// npm run dev, then open /dev/capture. 404s in production.

import { notFound } from "next/navigation";
import { MockAppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import CaptureHome from "@/components/capture/CaptureHome";
import { SAMPLE_STATE } from "@/lib/dev/sample-state";



export default function CapturePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <MockAppStateProvider state={SAMPLE_STATE}>
      <MotionProvider>
        <CaptureHome />
      </MotionProvider>
    </MockAppStateProvider>
  );
}
