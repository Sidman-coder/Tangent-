import { redirect } from "next/navigation";

// Tangents isn't its own tab any more: a path is a way to see a project, and
// opens from that project (Projects → View path). Paths that predate projects
// are listed under Projects → Other paths. Old links land there.
export default function TangentsRedirect() {
  redirect("/projects");
}
