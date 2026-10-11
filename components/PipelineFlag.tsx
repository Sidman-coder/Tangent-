"use client";

// Pipeline V2 flag for client components. The server reads TANGENT_PIPELINE_V2
// (lib/pipeline/flags.ts) and passes it down from app/(app)/layout.tsx, so the
// console and palette can hide the Plan/Calendar switch while it is on.

import { createContext, useContext } from "react";

const PipelineFlag = createContext(false);

export function PipelineFlagProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <PipelineFlag.Provider value={value}>{children}</PipelineFlag.Provider>;
}

/** True while TANGENT_PIPELINE_V2 is on: one box, previews, no mode switch. */
export function usePipelineV2(): boolean {
  return useContext(PipelineFlag);
}
