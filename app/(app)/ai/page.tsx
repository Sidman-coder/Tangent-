import { redirect } from "next/navigation";

// Round 4 Phase 4: there's no chat history page. Old links land on Home,
// where the box answers in place.
export default function AiPage(): never {
  redirect("/");
}
