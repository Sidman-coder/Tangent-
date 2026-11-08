// Run with `npm test`. Round 2 F.2: named model routes and the chat tier switch.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./models");

void (import("./models.ts" as string) as Promise<Mod>).then(({ MODEL_ROUTES, chatTier }) => {
  test("routes pick Haiku for small jobs and Sonnet for plans", () => {
    for (const r of ["classify", "title", "summary", "slot_extract", "route", "chat"] as const) assert.equal(MODEL_ROUTES[r], "FAST", r);
    for (const r of ["plan_draft", "plan_extend"] as const) assert.equal(MODEL_ROUTES[r], "SMART", r);
  });

  test("chat stays on FAST unless the talk is about planning", () => {
    assert.equal(chatTier([{ role: "user", content: "what does photosynthesis mean?" }]), "FAST");
    assert.equal(chatTier([{ role: "user", content: "thanks!" }]), "FAST");
    assert.equal(chatTier([{ role: "user", content: "help me plan my week" }]), "SMART");
    assert.equal(chatTier([{ role: "user", content: "when should I study for the bio test" }]), "SMART");
    // A short answer to a planning question keeps the planning model.
    assert.equal(
      chatTier([
        { role: "user", content: "help me plan my essay" },
        { role: "assistant", content: "How many days until it's due?" },
        { role: "user", content: "4" },
      ]),
      "SMART"
    );
    assert.equal(
      chatTier([
        { role: "assistant", content: "- Mon, Nov 9 — 4:00 PM — outline" },
        { role: "user", content: "ok" },
      ]),
      "SMART"
    );
  });
});
