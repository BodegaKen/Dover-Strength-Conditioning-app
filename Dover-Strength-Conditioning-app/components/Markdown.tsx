import React from "react";

// Small, dependency-free Markdown renderer for the coaching documents: headings, paragraphs,
// bullet and numbered lists, pipe tables, block quotes, horizontal rules, and **bold**, *italic*
// and `code`. Everything is rendered as React elements (text is escaped by React; no raw HTML).

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="bg-bg border border-line rounded px-1 text-[0.85em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1 ? "text-xl font-display uppercase tracking-wide mt-2"
        : level === 2 ? "text-lg font-display uppercase tracking-wide mt-4 border-b border-line pb-1"
        : "text-base font-semibold mt-3";
      const Tag = (`h${Math.min(level + 1, 6)}`) as keyof JSX.IntrinsicElements;
      blocks.push(React.createElement(Tag, { key: k(), className: cls }, inline(h[2], `h${key}`)));
      i++; continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={k()} className="border-line" />); i++; continue; }

    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(splitRow(lines[i])); i++; }
      const id = k();
      blocks.push(
        <div key={id} className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>{head.map((c, j) => <th key={j} className="text-left py-1.5 pr-3 border-b border-line text-muted uppercase text-xs tracking-wide align-bottom">{inline(c, `${id}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line align-top">
                  {r.map((c, j) => <td key={j} className="py-1.5 pr-3">{inline(c, `${id}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      const id = k();
      blocks.push(<blockquote key={id} className="border-l-4 border-accent pl-3 text-muted">{inline(buf.join(" "), id)}</blockquote>);
      continue;
    }

    const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(line);
    const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length) {
        const b = /^(\s*)([-*+])\s+(.*)$/.exec(lines[i]);
        const n = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(lines[i]);
        const mm = ordered ? n : b;
        if (mm) { items.push({ text: mm[3], indent: mm[1].length }); i++; continue; }
        // continuation line of the previous item (indented, non-blank)
        if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += " " + lines[i].trim(); i++; continue; }
        break;
      }
      const id = k();
      const List = ordered ? "ol" : "ul";
      blocks.push(
        React.createElement(
          List,
          { key: id, className: `${ordered ? "list-decimal" : "list-disc"} pl-5 flex flex-col gap-1` },
          items.map((it, j) => (
            <li key={j} style={{ marginLeft: Math.min(it.indent, 8) * 6 }}>{inline(it.text, `${id}i${j}`)}</li>
          ))
        )
      );
      continue;
    }

    // paragraph: gather until blank line or a new block starts
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) &&
      !/^\s*>\s?/.test(lines[i])
    ) { buf.push(lines[i].trim()); i++; }
    const id = k();
    blocks.push(<p key={id}>{inline(buf.join(" "), id)}</p>);
  }

  return <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed">{blocks}</div>;
}
