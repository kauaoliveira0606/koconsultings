import { airtableListFresh } from "@/lib/airtable/client";

/**
 * Every Bronson website on the Funnel tab (user, 2026-11-10), stored in
 * Airtable so sections and sites can be reordered by drag and drop.
 * Funnel Sections (Name/Description/Order) + Funnel Websites
 * (Name/URL/Description/Section/Order). A site's Section is the section's Name.
 */
const BASE = "appiMw8gpaLv2WITA";
const SECTIONS = "tblJk7HxxbRGDSfXG";
const SITES = "tblA4L3dF9pb6Wsor";

export type FunnelSite = { id: string; name: string; url: string; description: string; section: string; order: number };
export type FunnelSection = { id: string; name: string; description: string; order: number; sites: FunnelSite[] };

function pat() {
  const p = process.env.AIRTABLE_PAT;
  if (!p) throw new Error("Missing AIRTABLE_PAT");
  return p;
}

async function write(table: string, method: "POST" | "PATCH", records: unknown[]) {
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}`, {
      method,
      headers: { Authorization: `Bearer ${pat()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${method} ${table} failed (${res.status}): ${await res.text()}`);
  }
}

async function remove(table: string, id: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${pat()}` },
  });
  if (!res.ok) throw new Error(`Airtable DELETE ${table}/${id} failed (${res.status})`);
}

export async function getFunnel(): Promise<FunnelSection[]> {
  const [secRecs, siteRecs] = await Promise.all([airtableListFresh(BASE, SECTIONS), airtableListFresh(BASE, SITES)]);
  const sites: FunnelSite[] = siteRecs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        name: String(f.Name ?? ""),
        url: String(f.URL ?? ""),
        description: String(f.Description ?? ""),
        section: String(f.Section ?? ""),
        order: Number(f.Order ?? 999),
      };
    })
    .filter((s) => s.name || s.url);
  const sections: FunnelSection[] = secRecs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return { id: r.id, name: String(f.Name ?? ""), description: String(f.Description ?? ""), order: Number(f.Order ?? 999), sites: [] as FunnelSite[] };
    })
    .filter((s) => s.name)
    .sort((a, b) => a.order - b.order);

  const byName = new Map(sections.map((s) => [s.name, s]));
  const orphans: FunnelSite[] = [];
  for (const site of sites) (byName.get(site.section)?.sites ?? orphans).push(site);
  for (const s of sections) s.sites.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  if (orphans.length) sections.push({ id: "unsorted", name: "Unsorted", description: "Sites whose section was removed.", order: 9999, sites: orphans });
  return sections;
}

/** Save the full layout after a drag: section order, and each site's section + position. */
export async function saveLayout(layout: { sections: { id: string; name: string }[]; sites: { id: string; section: string }[][] }) {
  const current = await getFunnel();
  const sectionPatches = layout.sections
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.id !== "unsorted" && current.find((c) => c.id === s.id)?.order !== i)
    .map(({ s, i }) => ({ id: s.id, fields: { Order: i } }));

  const siteNow = new Map(current.flatMap((c) => c.sites).map((s) => [s.id, s]));
  const sitePatches: { id: string; fields: Record<string, unknown> }[] = [];
  layout.sites.forEach((list) =>
    list.forEach((site, i) => {
      const was = siteNow.get(site.id);
      if (!was || was.section !== site.section || was.order !== i) sitePatches.push({ id: site.id, fields: { Section: site.section, Order: i } });
    }),
  );
  if (sectionPatches.length) await write(SECTIONS, "PATCH", sectionPatches);
  if (sitePatches.length) await write(SITES, "PATCH", sitePatches);
}

export async function addSection(name: string, description = "") {
  const current = await getFunnel();
  await write(SECTIONS, "POST", [{ fields: { Name: name, Description: description, Order: current.length } }]);
}

export async function renameSection(id: string, name: string, description?: string) {
  const current = await getFunnel();
  const sec = current.find((s) => s.id === id);
  if (!sec) throw new Error("Section not found");
  const fields: Record<string, unknown> = { Name: name };
  if (description !== undefined) fields.Description = description;
  await write(SECTIONS, "PATCH", [{ id, fields }]);
  if (sec.name !== name && sec.sites.length) await write(SITES, "PATCH", sec.sites.map((s) => ({ id: s.id, fields: { Section: name } })));
}

export async function deleteSection(id: string) {
  const current = await getFunnel();
  const sec = current.find((s) => s.id === id);
  if (sec && sec.sites.length) throw new Error("Move the sites out of this section first.");
  await remove(SECTIONS, id);
}

export async function addSite(input: { name: string; url: string; description?: string; section: string }) {
  const current = await getFunnel();
  const n = current.find((s) => s.name === input.section)?.sites.length ?? 0;
  await write(SITES, "POST", [{ fields: { Name: input.name, URL: input.url, Description: input.description ?? "", Section: input.section, Order: n } }]);
}

export async function updateSite(id: string, fields: { name?: string; url?: string; description?: string }) {
  const f: Record<string, unknown> = {};
  if (fields.name !== undefined) f.Name = fields.name;
  if (fields.url !== undefined) f.URL = fields.url;
  if (fields.description !== undefined) f.Description = fields.description;
  await write(SITES, "PATCH", [{ id, fields: f }]);
}

export async function deleteSite(id: string) {
  await remove(SITES, id);
}
