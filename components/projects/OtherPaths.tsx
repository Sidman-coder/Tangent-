"use client";

// Paths made before a path belonged to a project (the old Tangents tab). They
// still open on their own page; new paths come from a project's View path.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Orbit } from "lucide-react";
import type { Path } from "@/lib/types";

export default function OtherPaths() {
  const [paths, setPaths] = useState<Path[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/path", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { paths: [] }))
      .then((d: { paths?: Path[] }) => live && setPaths((d.paths ?? []).filter((p) => !p.planId)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (paths.length === 0) return null;
  return (
    <section className="projects-other-paths" aria-labelledby="other-paths">
      <h2 id="other-paths">Other paths</h2>
      <ul>
        {paths.map((p) => (
          <li key={p.id}>
            <Link href={`/tangents/${p.id}`}>
              <Orbit size={15} aria-hidden="true" />
              <span>{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
