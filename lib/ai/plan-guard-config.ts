// Loads config/plan-guard.json for the server (the bundler handles the JSON
// import). Tests read the file directly; see lib/ai/plan-guard.test.ts.
import raw from "../../config/plan-guard.json";
import type { GuardConfig } from "./plan-guard";

export const PLAN_GUARD: GuardConfig = {
  bannedPhrases: raw.bannedPhrases,
  genericTitleWords: raw.genericTitleWords,
  minWhyLength: raw.minWhyLength,
};
