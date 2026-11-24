import { redirect } from "next/navigation";

// main's "Connectors" page (d010644) folded back into push-v1's settings:
// Canvas and calendars live on Schedule, so links to it land there.
export default function ConnectorsRedirect() {
  redirect("/settings/schedule");
}
