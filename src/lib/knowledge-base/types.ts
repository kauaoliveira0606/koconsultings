/**
 * Knowledge Base tab: static reference material the sales team pulls from
 * (offers, follow-up content, student wins, compliant disclaimer wording).
 * Each offer has its own data file; the four sections are the same for all.
 */

export type KbLink = { href: string; label: string };

/** A checkout link shown inside a pricing card, with Open and Copy buttons. */
export type KbCheckout = { title: string; text?: string; href: string };

export type KbItem = {
  title: string;
  /** Short line under the title: price, date, niche, who it's for. */
  meta?: string;
  /** Paragraph text, one string per paragraph. */
  text?: string[];
  bullets?: string[];
  quote?: string;
  /** Screenshot of the win; opens full size on click. */
  image?: string;
  links?: KbLink[];
  /** Checkout links listed at the bottom of a pricing card. */
  checkouts?: KbCheckout[];
  /** Exact wording to paste into a message; gets a Copy button. */
  copy?: string;
  /** Something the team still needs to confirm or watch out for. */
  note?: string;
  /** Small highlighted label on the card, e.g. "Top package". */
  badge?: string;
};

/**
 * How a group's items are laid out: "cards" (default grid), "stack" (full
 * width), "pricing" (package columns), "rows" (link list with Copy),
 * "gallery" (screenshot wins), "quotes" (testimonial quotes).
 */
export type KbLayout = "cards" | "stack" | "pricing" | "rows" | "gallery" | "quotes";

export type KbGroup = { title: string; description?: string; layout?: KbLayout; items: KbItem[] };

export type KbSectionId = "offers" | "content" | "wins" | "disclaimers";

export type KbSection = {
  id: KbSectionId;
  title: string;
  description: string;
  groups: KbGroup[];
};

export const KB_SECTIONS: { id: KbSectionId; title: string; description: string }[] = [
  {
    id: "offers",
    title: "Products & Offers",
    description: "Every offer we sell, with everything that comes with it.",
  },
  {
    id: "content",
    title: "Content Library",
    description: "Public content to send leads as value-driven follow-up.",
  },
  {
    id: "wins",
    title: "Testimonials & Wins",
    description: "Raw material of student wins: videos, screenshots, quotes.",
  },
  {
    id: "disclaimers",
    title: "Disclaimer Examples",
    description: "Rules for staying compliant whenever results or income come up.",
  },
];

/** Fills in any section an offer hasn't written yet, so every offer shows all four. */
export function withAllSections(groups: Partial<Record<KbSectionId, KbGroup[]>>): KbSection[] {
  return KB_SECTIONS.map((s) => ({ ...s, groups: groups[s.id] ?? [] }));
}
