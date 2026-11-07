"use client";

import { useEffect, useState } from "react";

/**
 * True while the media query matches.
 *
 * By default it starts false (the server's answer), so server and client
 * render the same thing. Pass `sync: true` only in components that render on
 * the client alone (a portal mounted after hydration, say): they then get the
 * right answer on their first render instead of flipping a frame later.
 */
export function useMediaQuery(query: string, options: { sync?: boolean } = {}): boolean {
  const [matches, setMatches] = useState(() =>
    options.sync && typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Phones: under 768px (docs/design/TANGENT-STYLE.md §5 breakpoints). */
export const PHONE_QUERY = "(max-width: 767px)";
