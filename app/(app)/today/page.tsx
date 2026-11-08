import { redirect } from "next/navigation";

// Today moved to /. Old bookmarks and notifications still land there.
export default function TodayRedirect() {
  redirect("/");
}
