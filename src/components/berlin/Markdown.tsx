import { Fragment, type ReactNode } from "react";

/** Inline: **bold**, *italic*, `code`, [text](url). */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-semibold text-[var(--text-strong)]">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-[var(--panel-subtle)] px-1 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/) ?? [];
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">{label}</a>);
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Small Markdown renderer for SOPs and skills: headings, lists, quotes, code blocks, tables (as text), rules. */
export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${n++}`;
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={key} className="my-3 overflow-x-auto rounded-lg bg-[var(--panel-subtle)] p-3 text-[12px] leading-relaxed">{buf.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = ["text-xl", "text-lg", "text-[16px]", "text-[15px]"][h[1].length - 1];
      blocks.push(<div key={key} className={`${size} mb-2 mt-5 font-bold text-[var(--text-strong)]`}>{inline(h[2], key)}</div>);
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={key} className="my-4 border-[var(--panel-border)]" />);
      i++;
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}
        </Tag>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key} className="my-3 border-l-4 border-[var(--panel-border)] pl-3 italic">{inline(buf.join(" "), key)}</blockquote>);
      continue;
    }
    if (line.trim().startsWith("|")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) buf.push(lines[i++]);
      const rows = buf.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {rows.map((r, j) => (
                <tr key={j} className={j === 0 ? "font-semibold text-[var(--text-strong)]" : ""}>
                  {r.map((c, k) => <td key={k} className="border border-[var(--panel-border)] px-2 py-1 align-top">{inline(c, `${key}-${j}-${k}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*+]|\d+\.)\s+|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={key} className="my-2">{buf.map((b, j) => <Fragment key={j}>{j ? " " : ""}{inline(b, `${key}-${j}`)}</Fragment>)}</p>);
  }
  return <div className="text-[14px] leading-relaxed text-[var(--text)]">{blocks}</div>;
}
