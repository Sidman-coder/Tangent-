// Master fix Phase 4: the small Markdown subset Tangent's replies use, parsed
// to plain data so ChatThread can render it without a dependency or raw HTML.
// Paragraphs, "- " / "1. " lists, "#" headings, ``` code blocks, and inline
// **bold**, *italic*, `code` and [links](https://…). Anything else is text.

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "h"; level: 1 | 2 | 3; inline: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; start: number; items: Inline[][] }
  | { type: "code"; text: string };

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const FENCE = /^\s*```/;

/** Inline marks inside one line. Unclosed marks stay as literal text. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)([^_]+?)(?<!\s)_(?![\w_])/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) out.push({ type: "text", text: line.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "code", text: m[2] });
    else if (m[3] !== undefined) out.push({ type: "link", text: m[3], href: m[4] });
    else out.push({ type: "italic", text: m[5] ?? m[6] });
    at = m.index + m[0].length;
  }
  if (at < line.length) out.push({ type: "text", text: line.slice(at) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let para: Inline[][] = [];
  let list: { type: "ul" | "ol"; start: number; items: Inline[][] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "p", lines: para });
    para = [];
    if (list) blocks.push(list.type === "ul" ? { type: "ul", items: list.items } : { type: "ol", start: list.start, items: list.items });
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "h", level: heading[1].length as 1 | 2 | 3, inline: parseInline(heading[2].trim()) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (para.length || (list && list.type !== type)) flush();
      if (!list) list = { type, start: numbered ? Number(numbered[1]) : 1, items: [] };
      list.items.push(parseInline((bullet ? bullet[1] : numbered![2]).trim()));
      continue;
    }
    if (list) {
      // An indented line continues the last item; anything else ends the list.
      if (/^\s{2,}\S/.test(line)) {
        const last = list.items[list.items.length - 1];
        last.push({ type: "text", text: " " }, ...parseInline(line.trim()));
        continue;
      }
      flush();
    }
    para.push(parseInline(line.trim()));
  }
  flush();
  return blocks;
}

/** The text a "Copy" puts on the clipboard: Markdown marks removed. */
export function plainText(source: string): string {
  return parseMarkdown(source)
    .map((b) => {
      const text = (inline: Inline[]) => inline.map((s) => s.text).join("");
      if (b.type === "p") return b.lines.map(text).join("\n");
      if (b.type === "h") return text(b.inline);
      if (b.type === "ul") return b.items.map((it) => `- ${text(it)}`).join("\n");
      if (b.type === "ol") return b.items.map((it, n) => `${b.start + n}. ${text(it)}`).join("\n");
      return b.text;
    })
    .join("\n\n");
}
