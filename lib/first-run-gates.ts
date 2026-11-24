// First-run overlay rules (overnight C01). A new student used to meet the setup
// form, a "one question" sheet, a 12-step tour and a notification prompt before
// they had typed anything. The rule now:
//
//  - Nothing optional opens until the student has a real item of their own
//    (not the School block onboarding writes, not a Canvas import).
//  - Only one optional overlay is ever open at a time (an "overlay gate").
//  - The tour never starts by itself; it is offered from Today and Settings.

import { isOnboardingSchoolTask } from "./school-block";
import type { Task } from "./types";

/** True once the student has added something themselves. */
export function hasFirstRealItem(tasks: readonly Task[] | null | undefined): boolean {
  if (!tasks) return false;
  return tasks.some((t) => t.source !== "canvas" && !isOnboardingSchoolTask(t));
}

/** A tiny shared lock: whoever claims it first shows; the rest wait. */
let holder: string | null = null;
const listeners = new Set<() => void>();

export function claimOverlay(name: string): boolean {
  if (holder !== null && holder !== name) return false;
  holder = name;
  listeners.forEach((l) => l());
  return true;
}

export function releaseOverlay(name: string): void {
  if (holder !== name) return;
  holder = null;
  listeners.forEach((l) => l());
}

export function overlayHolder(): string | null {
  return holder;
}

export function subscribeOverlay(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test helper. */
export function resetOverlayGate(): void {
  holder = null;
  listeners.clear();
}
