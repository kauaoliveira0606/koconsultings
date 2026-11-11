/**
 * Discord posting for Berlin (alerts, Jeremy AI feedback). Messages are capped
 * at 2,000 characters, so long text is split at line breaks (never mid-sentence)
 * and sent as several messages in order.
 */
export function splitForDiscord(text: string, limit = 1900): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    // A single line longer than the limit is split at the last space before it.
    let l = line;
    while (l.length > limit) {
      const cut = l.lastIndexOf(" ", limit) > 0 ? l.lastIndexOf(" ", limit) : limit;
      if (cur) {
        out.push(cur);
        cur = "";
      }
      out.push(l.slice(0, cut));
      l = l.slice(cut).trimStart();
    }
    if ((cur ? cur.length + 1 : 0) + l.length > limit) {
      out.push(cur);
      cur = l;
    } else {
      cur = cur ? `${cur}\n${l}` : l;
    }
  }
  if (cur.trim()) out.push(cur);
  return out.filter((c) => c.trim());
}

export async function postToDiscord(url: string, username: string, text: string, maxMessages = 6): Promise<boolean> {
  let ok = true;
  for (const content of splitForDiscord(text).slice(0, maxMessages)) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, content }) });
    ok = ok && res.ok;
  }
  return ok;
}
