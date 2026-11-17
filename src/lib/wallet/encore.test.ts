import { describe, expect, it } from "vitest";
import { eventById } from "./config";
import { currentSession, phase, previousSessionEnd, w3c } from "./schedule";

const enc = eventById("bronson-encore")!;
const mc = eventById("bronson-masterclass")!;

describe("encore wallet schedule", () => {
  it("points at the next Sun/Tue/Wed/Fri/Sat 8pm ET session and skips Mon + Thu", () => {
    // Mon Nov 16 noon ET -> Tue Nov 17 8pm ET
    expect(w3c(currentSession(enc, new Date("2026-11-16T17:00:00Z")).start)).toBe("2026-11-18T01:00:00+00:00");
    // Wed Nov 18 10pm ET (session over at 9:30) -> Fri Nov 20 (Thursday skipped)
    expect(w3c(currentSession(enc, new Date("2026-11-19T03:00:00Z")).start)).toBe("2026-11-21T01:00:00+00:00");
    // Sat Nov 21 10pm ET -> Sun Nov 22
    expect(w3c(currentSession(enc, new Date("2026-11-22T03:00:00Z")).start)).toBe("2026-11-23T01:00:00+00:00");
    // Sun Nov 22 10pm ET -> Tue Nov 24 (Monday skipped)
    expect(w3c(currentSession(enc, new Date("2026-11-23T03:00:00Z")).start)).toBe("2026-11-25T01:00:00+00:00");
  });
  it("stays on a session while it runs and rolls when it ends", () => {
    // Wed 9pm ET: session started 8pm, still current
    expect(w3c(currentSession(enc, new Date("2026-11-19T02:00:00Z")).start)).toBe("2026-11-19T01:00:00+00:00");
    expect(w3c(previousSessionEnd(enc, new Date("2026-11-19T03:00:00Z")))).toBe("2026-11-19T02:30:00+00:00");
    expect(phase(enc, new Date("2026-11-19T03:00:00Z")).phase).toBe("confirmed");
  });
  it("runs the same reminder ladder as the masterclass", () => {
    // Fri Nov 20 session 8pm ET = Sat 01:00Z
    expect(phase(enc, new Date("2026-11-20T01:30:00Z")).phase).toBe("tomorrow");
    expect(phase(enc, new Date("2026-11-20T05:30:00Z")).phase).toBe("today");
    expect(phase(enc, new Date("2026-11-20T22:00:00Z")).phase).toBe("lead"); // 5pm ET
    expect(phase(enc, new Date("2026-11-21T00:10:00Z")).phase).toBe("hour"); // 7:10pm ET
    expect(phase(enc, new Date("2026-11-21T01:00:00Z")).phase).toBe("live");
    expect(phase(enc, new Date("2026-11-21T01:15:00Z")).phase).toBe("last");
  });
  it("leaves the Monday masterclass pass alone", () => {
    expect(w3c(currentSession(mc, new Date("2026-11-05T12:00:00Z")).start)).toBe("2026-11-24T00:00:00+00:00");
  });
});
