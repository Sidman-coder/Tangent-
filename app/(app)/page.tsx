import { redirect } from "next/navigation";
import TodayHome from "@/components/today/TodayHome";

// Home is Today. The capture screen moved to /capture; links and shortcuts made
// before the move still arrive here with ?capture=1.
export default function HomePage({ searchParams }: { searchParams?: { capture?: string } }) {
  if (searchParams?.capture === "1") redirect("/capture?capture=1");
  return <TodayHome />;
}
