import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type Persona = { id: string; grade: number; ask: string; must_respect: string[] };
const file = JSON.parse(readFileSync(new URL("./fixtures/personas.json", import.meta.url), "utf8")) as { personas: Persona[] };

test("the Phase 2 personas are kept as fixtures", () => {
  assert.deepEqual(file.personas.map((p) => p.id), ["maya", "jordan", "leo", "priya", "sam"]);
});

test("every persona has a grade, a first ask and things to respect", () => {
  for (const p of file.personas) {
    assert.ok(p.grade >= 9 && p.grade <= 12, `${p.id} grade`);
    assert.ok(p.ask.length > 20, `${p.id} ask`);
    assert.ok(p.must_respect.length >= 2, `${p.id} must_respect`);
  }
});
