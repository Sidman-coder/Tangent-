"use client";

// The Grill me queue, kept fresh by GRILL_EVENT.

import { useCallback, useEffect, useState } from "react";
import { GRILL_EVENT, fetchGrill } from "@/lib/grill-client";
import type { GrillItem } from "@/lib/grill-queue";

export function useGrillQueue() {
  const [items, setItems] = useState<GrillItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    setItems(await fetchGrill());
    setLoaded(true);
  }, []);
  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener(GRILL_EVENT, on);
    return () => window.removeEventListener(GRILL_EVENT, on);
  }, [reload]);
  return { items, loaded, reload };
}
