"use client";

import * as React from "react";

/**
 * A tiny, dependency-free markdown-ish renderer.
 *
 * Supported:
 * - Paragraphs + line breaks
 * - Bullet lists (-, *, •)
 * - Numbered lists (1., 2., ...)
 * - Code fences ```lang ... ```
 * - Inline code `code`
 * - Bold **text**
 *
 * Intentionally minimal to keep the bundle small and avoid unsafe HTML.
 */

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang?: string; code: string };

function splitBlocks(src: string): Block[] {
  const text = (src ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // code fence
    const fence = line.match(/^```\s*([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const lang = fence[1];
      i += 1;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      // consume closing fence if present
      if (i < lines.length && lines[i].startsWith("```")) i += 1;
      blocks.push({ type: "code", lang, code: buf.join("\n") });
      continue;
    }

    // bullet list
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•])\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // paragraph (merge consecutive non-empty lines)
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      // stop before list or code fence
      if (
        /^```/.test(lines[i]) ||
        /^\s*([-*•])\s+/.test(lines[i]) ||
        /^\s*\d+\.\s+/.test(lines[i])
      )
        break;
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "p", text: buf.join("\n").trim() });
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);
  const out: React.ReactNode[] = [];

  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`")) {
      out.push(
        <code
          key={out.length}
          className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>,
      );
      continue;
    }

    // Bold **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    for (const bp of boldParts) {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        out.push(
          <strong key={out.length} className="font-semibold">
            {bp.slice(2, -2)}
          </strong>,
        );
      } else {
        out.push(<React.Fragment key={out.length}>{bp}</React.Fragment>);
      }
    }
  }

  return out;
}

export function MiniMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => splitBlocks(content), [content]);

  if (!content?.trim()) return null;

  return (
    <div className={className ?? ""}>
      {blocks.map((b, idx) => {
        if (b.type === "code") {
          return (
            <pre
              key={idx}
              className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100"
            >
              <code>{b.code}</code>
            </pre>
          );
        }

        if (b.type === "ul") {
          return (
            <ul key={idx} className="mt-2 list-disc space-y-1 pl-5">
              {b.items.map((it, i) => (
                <li key={i} className="leading-relaxed">
                  {renderInline(it)}
                </li>
              ))}
            </ul>
          );
        }

        if (b.type === "ol") {
          return (
            <ol key={idx} className="mt-2 list-decimal space-y-1 pl-5">
              {b.items.map((it, i) => (
                <li key={i} className="leading-relaxed">
                  {renderInline(it)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap leading-relaxed">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}