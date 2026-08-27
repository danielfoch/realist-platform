/**
 * renderMarkdownish — a tiny, safe renderer for the narrative `body` strings in
 * config reports. NOT full markdown: it supports exactly what the schema
 * documents, and it never injects raw HTML (everything is React text nodes).
 * No hooks, no browser APIs — renders fine inside a server component, so the
 * report prose lands in the HTML.
 *
 * Supported:
 *   - paragraphs separated by blank lines
 *   - `## ` subheadings (rendered as <h3>)
 *   - `- ` bullet lists
 *   - inline `**bold**`
 *   - inline `[label](https://…)` links (http/https/relative only)
 */
import type { ReactNode } from "react";

const INLINE_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_RE).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    if (link) {
      const isExternal = link[2].startsWith("http");
      return (
        <a
          key={key}
          href={link[2]}
          className="text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function renderMarkdownish(body: string): ReactNode {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, bi) => {
    if (block.startsWith("## ")) {
      return (
        <h3 key={bi} className="font-display mt-8 mb-2 text-xl font-semibold text-ink">
          {renderInline(block.slice(3).trim(), `h-${bi}`)}
        </h3>
      );
    }
    const lines = block.split("\n");
    if (lines.every((l) => l.trimStart().startsWith("- "))) {
      return (
        <ul key={bi} className="my-4 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-ink-soft">
          {lines.map((l, li) => (
            <li key={li}>{renderInline(l.trimStart().slice(2), `li-${bi}-${li}`)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={bi} className="my-4 text-[15px] leading-7 text-ink-soft">
        {renderInline(block, `p-${bi}`)}
      </p>
    );
  });
}
