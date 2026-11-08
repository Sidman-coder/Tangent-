// The first onboarding question (Round 4, Phase 1.2): "How old are you?".
// A neutral picker (every age from 7 or younger to 19 or older, nothing that
// hints at the cut-off). Under 13 is kept only as a yes/no flag in
// app_metadata (lib/auth/password-server.ts markUnder13); the age itself is
// never stored. Pure, so lib/auth-gate.test.ts covers it.

export const MIN_AGE = 13;

export type AgeOption = { value: number; label: string };

/** 7 means "7 or younger", 19 means "19 or older". */
export const AGE_OPTIONS: AgeOption[] = Array.from({ length: 13 }, (_, i) => {
  const value = 7 + i;
  return { value, label: value === 7 ? "7 or younger" : value === 19 ? "19 or older" : String(value) };
});

export type AgeAnswer = { ok: true; under13: boolean } | { ok: false; error: string };

export function parseAgeAnswer(body: unknown): AgeAnswer {
  const age = (body as { age?: unknown } | null)?.age;
  if (typeof age !== "number" || !Number.isInteger(age) || age < 7 || age > 19) {
    return { ok: false, error: "Pick your age from the list." };
  }
  return { ok: true, under13: age < MIN_AGE };
}

/** Per device, so Redo setup and a refresh don't ask again. */
export function ageStorageKey(email: string): string {
  return `tangent-age-ok:${email.toLowerCase()}`;
}
