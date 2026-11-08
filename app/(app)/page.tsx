import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TodayHome from "@/components/today/TodayHome";
import { ENTERED_COOKIE } from "@/lib/entry";

// Home inside the app is Today. Opening the app (a new browser session, sign-in,
// the installed app, the end of onboarding) starts on the capture home instead:
// the big mic and your list (/capture). It sets a session cookie, so "Open app"
// and every in-app link to / land here on Today. Links with a query (?ask=1,
// ?capture=1) keep their meaning.
export default function HomePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if (searchParams?.capture === "1") redirect("/capture?capture=1");
  const hasQuery = Object.keys(searchParams ?? {}).length > 0;
  if (!hasQuery && !cookies().get(ENTERED_COOKIE)) redirect("/capture");
  return <TodayHome />;
}
