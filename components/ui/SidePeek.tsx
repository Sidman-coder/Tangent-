"use client";

import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";

type SidePeekProps = {
  open: boolean;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
};

/** A side sheet whose title lives in its content. Kept for existing callers; new code uses Sheet. */
export default function SidePeek({ open, titleId, onClose, children }: SidePeekProps) {
  return (
    <Sheet open={open} titleId={titleId} onClose={onClose} variant="side" closeLabel="Close panel">
      {children}
    </Sheet>
  );
}
