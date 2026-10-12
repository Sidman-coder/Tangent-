// Run with `npm test`. Master fix Phase 4: the reply Markdown subset.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./markdown-parse");

void (import("./markdown-parse.ts" as string) as Promise<Mod>).then(({ parseMarkdown, parseInline, plainText }) => {
  test("inline marks: bold, italic, code and safe links", () => {
    assert.deepEqual(parseInline("Study **math** first, *then* `review`"), [
      { type: "text", text: "Study " },
      { type: "bold", text: "math" },
      { type: "text", text: " first, " },
      { type: "italic", text: "then" },
      { type: "text", text: " " },
      { type: "code", text: "review" },
    ]);
    assert.deepEqual(parseInline("See [the guide](https://example.com/a)"), [
      { type: "text", text: "See " },
      { type: "link", text: "the guide", href: "https://example.com/a" },
    ]);
    // Not a link: only http(s) is ever made clickable.
    assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ type: "text", text: "[x](javascript:alert(1))" }]);
    // Stray stars and snake_case are plain text.
    assert.deepEqual(parseInline("5 * 3 = 15 and my_var_name"), [{ type: "text", text: "5 * 3 = 15 and my_var_name" }]);
  });

  test("blocks: paragraphs, lists, headings and code", () => {
    const blocks = parseMarkdown("Here's a plan:\n\n## This week\n- Mon, Oct 12 — 4:00 PM — Math\n- Tue — Reading\n\n1. First\n2. Second\n\n```\nraw *text*\n```\nThanks");
    assert.deepEqual(blocks.map((b) => b.type), ["p", "h", "ul", "ol", "code", "p"]);
    const ul = blocks[2] as Extract<(typeof blocks)[number], { type: "ul" }>;
    assert.equal(ul.items.length, 2);
    assert.deepEqual(blocks[4], { type: "code", text: "raw *text*" });
  });

  test("a schedule line right after text starts a list; a blank line ends it", () => {
    const blocks = parseMarkdown("Plan:\n- one\n- two\nAfter");
    assert.deepEqual(blocks.map((b) => b.type), ["p", "ul", "p"]);
  });

  test("Copy gives plain text", () => {
    assert.equal(plainText("**Plan**\n- *one*\n- two"), "Plan\n\n- one\n- two");
  });
});
