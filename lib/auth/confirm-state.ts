// When the "confirm password" box may complain. Pure, so the rule is tested
// without a browser.
//
//   - A mismatch shows only after the confirm box loses focus (`blur`) or the
//     form is submitted (`submit`).
//   - Any edit to either box hides it again until the next blur or submit.
//   - "Passwords match" shows as soon as the two are equal and not empty.

export const PASSWORD_MISMATCH = "The two passwords don't match.";

export type ConfirmState = {
  /** The confirm box lost focus since the last edit. */
  blurred: boolean;
  /** The form tried to submit since the last edit. */
  submitted: boolean;
};

export type ConfirmEvent = "blur" | "submit" | "editConfirm" | "editPassword";

export type ConfirmView = "idle" | "mismatch" | "match";

export const initialConfirmState: ConfirmState = { blurred: false, submitted: false };

export function confirmReducer(state: ConfirmState, event: ConfirmEvent): ConfirmState {
  switch (event) {
    case "blur":
      return state.blurred ? state : { ...state, blurred: true };
    case "submit":
      return state.blurred && state.submitted ? state : { blurred: true, submitted: true };
    case "editConfirm":
    case "editPassword":
      return state.blurred || state.submitted ? initialConfirmState : state;
  }
}

export function confirmView(password: string, confirm: string, state: ConfirmState): ConfirmView {
  if (confirm.length > 0 && confirm === password) return "match";
  if (confirm !== password) {
    // Tabbing through an empty box is not a mistake; trying to submit one is.
    if (state.submitted) return "mismatch";
    if (state.blurred && confirm.length > 0) return "mismatch";
  }
  return "idle";
}

/** True when a form-level problem is just the mismatch the field already shows. */
export function isMismatchProblem(problem: string | null | undefined): boolean {
  return problem === PASSWORD_MISMATCH;
}
