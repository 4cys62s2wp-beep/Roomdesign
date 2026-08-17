// Minimaler Markdown-Renderer für KI-Texte (Absätze, **fett**, *kursiv*,
// Überschriften, Listen) – bewusst ohne externe Abhängigkeit.

import React from "react";

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|„[^"]*"|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={key++} className="rounded bg-sand px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (/^#{1,4}\s/.test(trimmed)) {
          const content = trimmed.replace(/^#{1,4}\s/, "");
          return (
            <h4 key={blockIndex} className="mt-3 mb-1.5 font-display text-base font-semibold">
              {renderInline(content)}
            </h4>
          );
        }
        const lines = trimmed.split("\n");
        if (lines.every((line) => /^[-*•]\s/.test(line.trim()))) {
          return (
            <ul key={blockIndex} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.trim().replace(/^[-*•]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="my-2 text-sm leading-relaxed">
            {lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
