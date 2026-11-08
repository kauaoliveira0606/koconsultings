import { describe, expect, it } from "vitest";
import { eventById } from "./config";
import { passJson } from "./pass";

process.env.WALLET_PASS_TYPE_ID ||= "pass.com.test.events";

describe("time on front", () => {
  it("bronson shows TIME instead of STATUS, status on back", () => {
    const j = passJson(eventById("bronson-masterclass")!, "s", "t", new Date("2026-11-10T12:00:00Z"));
    const aux = j.eventTicket.auxiliaryFields.map((f) => `${f.key}=${f.value}`);
    expect(aux).toContain("time=7:00 PM EST");
    expect(aux.some((a) => a.startsWith("status="))).toBe(false);
    expect(j.eventTicket.backFields.some((f) => f.key === "status")).toBe(true);
  });
  it("aval unchanged", () => {
    const j = passJson(eventById("aval-masterclass")!, "s", "t", new Date("2026-11-10T12:00:00Z"));
    expect(j.eventTicket.auxiliaryFields.some((f) => f.key === "status")).toBe(true);
    expect(j.eventTicket.backFields.some((f) => f.key === "status")).toBe(false);
  });
});
