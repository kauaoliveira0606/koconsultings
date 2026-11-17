import { describe, expect, it } from "vitest";
import { inSendWindow, nextEncore, noShowText, whenWords } from "./encore-schedule";

const at = (iso: string) => Date.parse(iso);

describe("encore no-show wording", () => {
  it("names tonight / tomorrow / the weekday, skipping the live days Monday and Thursday", () => {
    // Tue 9:30 PM ET (after the 8 PM session): next is Wed
    expect(whenWords(at("2026-11-18T02:30:00Z"))).toBe("tomorrow at 8pm est");
    // Wed 9:30 PM ET: Thursday is live, next Encore is Friday
    expect(whenWords(at("2026-11-19T02:30:00Z"))).toBe("Friday at 8pm est");
    // Sun 9:30 PM ET: Monday is live, next Encore is Tuesday
    expect(whenWords(at("2026-11-23T02:30:00Z"))).toBe("Tuesday at 8pm est");
    // Fri 9:30 PM ET: Saturday
    expect(whenWords(at("2026-11-21T02:30:00Z"))).toBe("tomorrow at 8pm est");
    // Sat morning: tonight
    expect(whenWords(at("2026-11-21T15:00:00Z"))).toBe("tonight at 8pm est");
  });
  it("uses the user's wording and only names someone with a real first name", () => {
    expect(noShowText("Kaua", at("2026-11-18T02:30:00Z"))).toBe("Hey Kaua, saw you missed the masterclass, no worries. I can give you a private invite for tomorrow at 8pm est. I'm hosting one more for people that missed it. Want me to save your seat?");
    expect(noShowText(null, at("2026-11-18T02:30:00Z"))).toBe("Hey, saw you missed the masterclass, no worries. I can give you a private invite for tomorrow at 8pm est. I'm hosting one more for people that missed it. Want me to save your seat?");
  });
  it("matches the AEvent schedule", () => {
    const n = nextEncore(at("2026-11-16T17:00:00Z"));
    expect(new Date(n.startsAt).toISOString()).toBe("2026-11-18T01:00:00.000Z"); // Tue Nov 17 8 PM ET
    expect(n.dayName).toBe("Tuesday");
  });
  it("only sends 9 AM to 10:45 PM Eastern", () => {
    expect(inSendWindow(at("2026-11-18T02:35:00Z"))).toBe(true); // 9:35 PM ET
    expect(inSendWindow(at("2026-11-18T04:00:00Z"))).toBe(false); // 11 PM ET
    expect(inSendWindow(at("2026-11-18T10:00:00Z"))).toBe(false); // 5 AM ET
    expect(inSendWindow(at("2026-11-18T14:30:00Z"))).toBe(true); // 9:30 AM ET
  });
});
