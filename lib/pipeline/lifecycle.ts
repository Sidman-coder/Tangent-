// Pipeline V2: what each preview-card action may do to a ChangeSet in its
// current status. Pure, so the rules are unit tested apart from the routes
// (app/api/changesets/[id]/*), which do the reads and writes.
//
//   draft ──confirm──▶ confirmed ──undo──▶ undone
//     └────discard──▶ discarded
//
// Repeating an action that already happened (a double click, a retry) is
// "already": the route answers with the first result instead of acting again.

import type { ChangeSetStatus } from "./changeset";

export type CardAction = "confirm" | "discard" | "undo" | "edit" | "shown";

export type Step =
  | { kind: "proceed" }
  | { kind: "already" }
  | { kind: "refuse"; message: string };

const refuse = (message: string): Step => ({ kind: "refuse", message });

export function nextStep(action: CardAction, cs: { status: ChangeSetStatus; action_id: string | null }): Step {
  const { status } = cs;
  switch (action) {
    case "confirm":
      if (status === "draft") return { kind: "proceed" };
      if (status === "confirmed") return { kind: "already" };
      return refuse(status === "discarded" ? "That change was discarded." : "That change was already undone.");
    case "discard":
      if (status === "draft") return { kind: "proceed" };
      if (status === "discarded") return { kind: "already" };
      return refuse(status === "confirmed" ? "Those changes were already added. Use Undo instead." : "That change was already undone.");
    case "undo":
      if (status === "confirmed") return cs.action_id ? { kind: "proceed" } : refuse("Nothing was added, so there is nothing to undo.");
      if (status === "undone") return { kind: "already" };
      return refuse(status === "draft" ? "Those changes haven't been added yet." : "That change was discarded.");
    case "edit":
      return status === "draft" ? { kind: "proceed" } : refuse("Only a preview that hasn't been confirmed can be edited.");
    case "shown":
      return status === "draft" ? { kind: "proceed" } : { kind: "already" };
  }
}
