"use client";

// Master fix Phase 4: renders a reply's Markdown (components/console/markdown-parse.ts)
// as React elements, never raw HTML. `reveal` fades a fresh reply in word by
// word, as RevealText did; the stagger is capped so long replies finish in
// about a second.

import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/components/console/markdown-parse";

export default function Markdown({ text, reveal = false }: { text: string; reveal?: boolean }) {
  let word = 0;
  const words = (s: string): ReactNode => {
    if (!reveal) return s;
    return s.split(/(\s+)/).map((part, i) => {
      if (!part.trim()) return part;
      const delay = Math.min(word++ * 22, 1100);
      return (
        <span key={i} className="tg-word" style={{ animationDelay: `${delay}ms` }}>
          {part}
        </span>
      );
    });
  };
  const inline = (parts: Inline[]) =>
    parts.map((p, i) => {
      if (p.type === "bold") return <strong key={i}>{words(p.text)}</strong>;
      if (p.type === "italic") return <em key={i}>{words(p.text)}</em>;
      if (p.type === "code") return <code key={i} className="tg-md-code">{p.text}</code>;
      if (p.type === "link")
        return (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {words(p.text)}
          </a>
        );
      return <Fragment key={i}>{words(p.text)}</Fragment>;
    });

  return (
    <div className="tg-md">
      {parseMarkdown(text).map((b, i) => {
        if (b.type === "p")
          return (
            <p key={i}>
              {b.lines.map((line, n) => (
                <Fragment key={n}>
                  {n > 0 && <br />}
                  {inline(line)}
                </Fragment>
              ))}
            </p>
          );
        if (b.type === "h") {
          const Tag = b.level === 1 ? "h3" : b.level === 2 ? "h4" : "h5";
          return <Tag key={i}>{inline(b.inline)}</Tag>;
        }
        if (b.type === "ul") return <ul key={i}>{b.items.map((it, n) => <li key={n}>{inline(it)}</li>)}</ul>;
        if (b.type === "ol")
          return (
            <ol key={i} start={b.start}>
              {b.items.map((it, n) => <li key={n}>{inline(it)}</li>)}
            </ol>
          );
        return (
          <pre key={i} className="tg-md-pre">
            <code>{b.text}</code>
          </pre>
        );
      })}
    </div>
  );
}
