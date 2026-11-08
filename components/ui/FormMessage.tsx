import type { ReactNode } from "react";

export type FormMessageTone = "success" | "error" | "info";

/** A one-line result under a form: "Saved", or what went wrong. Errors are
 *  announced right away; the rest politely. */
export default function FormMessage({ tone = "info", children }: { tone?: FormMessageTone; children: ReactNode }) {
  if (!children) return null;
  return (
    <p className={`form-message is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
