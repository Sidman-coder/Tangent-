"use client";

// /projects/<id>: the project view (components/projects/ProjectView.tsx).

import { useParams } from "next/navigation";
import ProjectView from "@/components/projects/ProjectView";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectView id={id} />;
}
