import { redirect } from "next/navigation";

// main's "Your Tangent" page (d010644) folded back into push-v1's settings:
// its contents live on What Tangent knows, so links to it land there.
export default function YourTangentRedirect() {
  redirect("/settings/context");
}
