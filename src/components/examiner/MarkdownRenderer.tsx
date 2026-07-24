"use client";

/**
 * MarkdownRenderer — lightweight, safe markdown renderer for AI chat responses.
 *
 * Handles the markdown patterns the AI Tutor / Teacher AI Assistant produces:
 *   - Headings: ## / ### / ####
 *   - Bold: **text**
 *   - Italic: *text*
 *   - Inline code: `code`
 *   - Links: [text](url)
 *   - Unordered lists: - item
 *   - Ordered lists: 1. item
 *   - Tables: | col | col |
 *   - Horizontal rules: ---
 *   - Code blocks: ```lang\ncode\n```
 *   - Blockquotes: > text
 *
 * Safety: parses text and renders React elements — NO dangerouslySetInnerHTML.
 * Links are sanitized (only https:// or http:// URLs, rel="noopener noreferrer").
 *
 * The renderer is intentionally NOT a full CommonMark parser — it handles
 * the subset the AI actually produces, keeping the bundle small and the
 * rendering fast.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/** Sanitize a URL — only allow http(s) links. Prevents javascript: URLs. */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed; // relative links + anchors are safe
  }
  return null; // block javascript:, data:, etc.
}

/** Render inline markdown: **bold**, *italic*, `code`, [links](url). */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex matches: **bold** | *italic* | `code` | [text](url)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-background px-1 py-0.5 text-[0.85em] font-mono text-primary border border-border">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      // [text](url)
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const url = safeUrl(linkMatch[2]);
        if (url) {
          nodes.push(
            <a key={key} href={url} target="_blank" rel="noopener noreferrer"
               className="text-primary underline underline-offset-2 hover:text-primary/80 break-all">
              {linkText}
            </a>
          );
        } else {
          nodes.push(linkText); // show text without link if URL is unsafe
        }
      }
    }
    lastIndex = match.index + token.length;
  }
  // Push remaining plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/** Parse a markdown table block into rows + headers. */
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const headers = lines[0].split("|").map(c => c.trim()).filter(c => c.length > 0);
  // Line 1 is the separator (|---|---|), skip it
  const rows = lines.slice(2).map(line =>
    line.split("|").map(c => c.trim()).filter(c => c.length > 0)
  ).filter(row => row.length > 0);
  return { headers, rows };
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      elements.push(<hr key={`hr-${keyCounter++}`} className="my-3 border-border" />);
      i++;
      continue;
    }

    // Code block (```)
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={`code-${keyCounter++}`} className="my-2 overflow-x-auto rounded-lg bg-background border border-border p-3 text-xs">
          <code className="font-mono text-foreground/90">{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headings (## / ### / ####)
    const headingMatch = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 2) {
        elements.push(<h3 key={`h-${keyCounter++}`} className="mt-3 mb-1.5 text-base font-bold text-foreground">{renderInline(text, `h2-${keyCounter}`)}</h3>);
      } else if (level === 3) {
        elements.push(<h4 key={`h-${keyCounter++}`} className="mt-2.5 mb-1 text-sm font-bold text-foreground">{renderInline(text, `h3-${keyCounter}`)}</h4>);
      } else {
        elements.push(<h5 key={`h-${keyCounter++}`} className="mt-2 mb-1 text-xs font-bold text-foreground">{renderInline(text, `h4-${keyCounter}`)}</h5>);
      }
      i++;
      continue;
    }

    // Table (line starts with |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = parseTable(tableLines);
      if (table) {
        elements.push(
          <div key={`table-${keyCounter++}`} className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  {table.headers.map((h, hi) => (
                    <th key={hi} className="text-left py-1.5 px-2 font-semibold text-foreground">
                      {renderInline(h, `th-${keyCounter}-${hi}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-2 text-foreground/90 align-top">
                        {renderInline(cell, `td-${keyCounter}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Unordered list (- item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${keyCounter++}`} className="my-1.5 space-y-1 pl-4">
          {listItems.map((item, li) => (
            <li key={li} className="text-foreground/90 flex gap-1.5">
              <span className="text-primary flex-shrink-0">•</span>
              <span>{renderInline(item, `li-${keyCounter}-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. item)
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const listItems: string[] = [];
      const numbers: number[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^(\d+)\.\s+(.+)$/);
        if (!m) break;
        numbers.push(parseInt(m[1], 10));
        listItems.push(m[2]);
        i++;
      }
      elements.push(
        <ol key={`ol-${keyCounter++}`} className="my-1.5 space-y-1 pl-4">
          {listItems.map((item, li) => (
            <li key={li} className="text-foreground/90 flex gap-1.5">
              <span className="text-primary font-medium flex-shrink-0">{numbers[li]}.</span>
              <span>{renderInline(item, `oli-${keyCounter}-${li}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote (> text)
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${keyCounter++}`} className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
          {renderInline(quoteLines.join(" "), `bq-${keyCounter}`)}
        </blockquote>
      );
      continue;
    }

    // [Coherence Check] section — render in a highlighted box
    if (trimmed.startsWith("[Coherence Check]")) {
      const checkLines: string[] = [trimmed];
      i++;
      // Collect all lines until the next empty line or end
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("[")) {
        checkLines.push(lines[i].trim());
        i++;
      }
      elements.push(
        <div key={`cc-${keyCounter++}`} className="my-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs space-y-1">
          <div className="font-semibold text-primary flex items-center gap-1.5">
            <span>🎯 Coherence Check</span>
          </div>
          {checkLines.slice(1).map((line, li) => (
            <div key={li} className="text-foreground/90">
              {renderInline(line, `cc-${keyCounter}-${li}`)}
            </div>
          ))}
        </div>
      );
      continue;
    }

    // Regular paragraph (may span multiple consecutive non-empty, non-special lines)
    const paragraphLines: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("> ") &&
      !lines[i].trim().startsWith("```") &&
      !/^---+$/.test(lines[i].trim()) &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      !lines[i].trim().startsWith("[Coherence Check]")
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    elements.push(
      <p key={`p-${keyCounter++}`} className="my-1 text-foreground/90">
        {renderInline(paragraphLines.join(" "), `p-${keyCounter}`)}
      </p>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {elements}
    </div>
  );
}
