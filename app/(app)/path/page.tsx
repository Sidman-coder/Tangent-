import { redirect } from "next/navigation";

// Path became Tangents, then a view of each project. Anything pointing here - a
// bookmark, a link in an old message - lands in the right place.
export default function LegacyPathRedirect() {
  redirect("/projects");
}
