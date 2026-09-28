import { redirect } from "next/navigation";

// Path became Tangents, and one path became many. Anything pointing here - a
// bookmark, a link in an old message - lands in the right place.
export default function LegacyPathRedirect() {
  redirect("/tangents");
}
