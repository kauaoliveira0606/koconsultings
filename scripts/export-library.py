#!/usr/bin/env python3
"""
Copy of the Skills & SOPs library on the user's Mac (user, 2026-11-11).

Pulls every doc from the dashboard (/api/bronson/brain) and writes one Markdown
file per doc into ~/Desktop/Knowledge Library:

  Skills/<skill>.md
  Knowledge base/<n> <Pillar>/<Area>/<doc>.md
  INDEX.md

The dashboard library stays the main copy; this folder is rebuilt from it on
every run (launchd runs it hourly; Claude runs it after adding knowledge).
Only files this script wrote are removed, tracked in .export-manifest.json.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser("~/Desktop/Knowledge Library")
URL = "https://www.koconsultings.com/api/bronson/brain?full=1"


def token():
    src = open(os.path.join(REPO, "src/lib/admin-gate.ts")).read()
    return re.search(r'SERVICE_TOKEN = "([^"]+)"', src).group(1)


def safe(name, limit=120):
    name = re.sub(r'[/\\:*?"<>|]', "-", name).strip(" .")
    return name[:limit].rstrip(" .") or "untitled"


def main():
    req = urllib.request.Request(URL, headers={"Cookie": f"koc_admin={token()}"})
    data = json.load(urllib.request.urlopen(req, timeout=120))
    docs, areas, pillars = data["docs"], data["areas"], data["pillars"]
    area_by = {a["id"]: a for a in areas}
    pillar_dir = {p["id"]: f"{i + 1} {p['label']}" for i, p in enumerate(pillars)}

    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, ".export-manifest.json")
    old = set(json.load(open(man_path))) if os.path.exists(man_path) else set()
    written, index = set(), {}

    for d in docs:
        secs = [s for s in d["sections"] if s in area_by] or ["general"]
        if d["type"] == "Skill":
            rel = os.path.join("Skills", safe(d["title"]) + ".md")
            group = "Skills"
        else:
            a = area_by[secs[0]]
            rel = os.path.join("Knowledge base", pillar_dir[a["pillar"]], safe(a["label"]), safe(d["title"]) + ".md")
            group = f"{pillar_dir[a['pillar']]} / {a['label']}"
        if rel in written:  # same title twice
            rel = rel[:-3] + f" ({d['id'][-5:]}).md"
        also = ", ".join(area_by[s]["label"] for s in secs[1:])
        head = [f"# {d['title']}", "", f"- **Type:** {d['type']}"]
        if d["category"]:
            head.append(f"- **Category:** {d['category']}")
        head.append(f"- **Areas:** {', '.join(area_by[s]['label'] for s in secs)}")
        if d["summary"]:
            head.append(f"- **Summary:** {d['summary']}")
        if d["learnsFrom"] or d["source"]:
            head.append(f"- **Source:** {(d['learnsFrom'] or d['source']).splitlines()[0]}")
        if d["updated"]:
            head.append(f"- **Updated:** {d['updated']}")
        text = "\n".join(head) + "\n\n---\n\n" + d["body"].strip() + "\n"
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not os.path.exists(path) or open(path, encoding="utf-8").read() != text:
            open(path, "w", encoding="utf-8").write(text)
        written.add(rel)
        index.setdefault(group, []).append((d["title"], rel, also))

    # Remove files from earlier runs whose doc was deleted or moved.
    for rel in old - written:
        p = os.path.join(OUT, rel)
        if os.path.exists(p):
            os.remove(p)
    for root, dirs, files in os.walk(OUT, topdown=False):
        if root != OUT and not os.listdir(root):
            os.rmdir(root)

    lines = [
        "# Knowledge Library",
        "",
        f"Copy of the Skills & SOPs library on koconsultings.com/bronson/brain, rebuilt {datetime.now():%Y-%m-%d %H:%M}.",
        "Don't edit files here: they're overwritten from the dashboard. Add knowledge on the dashboard or tell Claude.",
        "",
        f"{len(docs)} docs.",
        "",
    ]
    for group in ["Skills"] + sorted(g for g in index if g != "Skills"):
        if group not in index:
            continue
        lines.append(f"## {group} ({len(index[group])})")
        for title, rel, also in sorted(index[group]):
            lines.append(f"- [{title}](<{rel}>)" + (f" · also in {also}" if also else ""))
        lines.append("")
    open(os.path.join(OUT, "INDEX.md"), "w", encoding="utf-8").write("\n".join(lines))
    json.dump(sorted(written), open(man_path, "w"))
    print(f"Exported {len(written)} docs to {OUT}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # launchd log
        print(f"{datetime.now():%Y-%m-%d %H:%M} export failed: {e}", file=sys.stderr)
        sys.exit(1)
