import { describe, expect, it } from "vitest";
import { eventById } from "./config";
import { currentSession, phase, previousSessionEnd, w3c } from "./schedule";

const enc = eventById("bronson-encore")!;
const mc = eventById("bronson-masterclass")!;

describe("encore wallet schedule", () => {
  it("points at the next Sun/Tue/Wed/Fri/Sat 8pm ET session and skips Mon + Thu", () => {
    // Mon Nov 16 noon ET -> Tue Nov 17 8pm ET
    expect(w3c(currentSession(enc, new Date("2026-11-16T17:00:00Z")).start)).toBe("2026-11-18T01:00:00+00:00");
    // Wed Nov 18 9pm ET (after the session started) -> Fri Nov 20 (Thursday skipped)
    expect(w3c(currentSession(enc, new Date("2026-11-19T02:00:00Z")).start)).toBe("2026-11-21T01:00:00+00:00");
    // Sat Nov 21 9pm ET -> Sun Nov 22
    expect(w3c(currentSession(enc, new Date("2026-11-22T02:00:00Z")).start)).toBe("2026-11-23T01:00:00+00:00");
    // Sun Nov 22 9pm ET -> Tue Nov 24 (Monday skipped)
    expect(w3c(currentSession(enc, new Date("2026-11-23T02:00:00Z")).start)).toBe("2026-11-25T01:00:00+00:00");
  });
  it("rolls the moment a session starts, and knows when it rolled", () => {
    const now = new Date("2026-11-19T02:00:00Z"); // Wed 9pm ET
    expect(w3c(previousSessionEnd(enc, now))).toBe("2026-11-19T01:00:00+00:00");
    expect(phase(enc, now).phase).toBe("confirmed");
    // 7:10pm ET Fri = inside the one hour lead
    expect(phase(enc, new Date("2026-11-21T00:10:00Z")).phase).toBe("lead");
  });
  it("leaves the Monday masterclass pass alone", () => {
    expect(w3c(currentSession(mc, new Date("2026-11-05T12:00:00Z")).start)).toBe("2026-11-17T00:00:00+00:00");
  });
});
