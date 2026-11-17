import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventById } from "./config";
import { buildPkpass, passJson } from "./pass";
import { currentSession, leadLabel, phase, w3c } from "./schedule";

const ev = eventById("bronson-masterclass")!;

describe("wallet schedule", () => {
  it("pins Nov 23 7pm ET and rolls weekly after that day", () => {
    expect(w3c(currentSession(ev, new Date("2026-11-05T12:00:00Z")).start)).toBe("2026-11-24T00:00:00+00:00");
    // still the 23rd late that evening ET
    expect(w3c(currentSession(ev, new Date("2026-11-24T04:30:00Z")).start)).toBe("2026-11-24T00:00:00+00:00");
    // after midnight ET it rolls to Nov 30
    expect(w3c(currentSession(ev, new Date("2026-11-24T05:30:00Z")).start)).toBe("2026-12-01T00:00:00+00:00");
  });
  it("phases and lead wording", () => {
    expect(phase(ev, new Date("2026-11-23T01:00:00Z")).phase).toBe("tomorrow");
    // after midnight ET on the day itself it is "today", not "tomorrow"
    expect(phase(ev, new Date("2026-11-23T05:30:00Z")).phase).toBe("today");
    expect(phase(ev, new Date("2026-11-23T19:00:00Z")).phase).toBe("today");
    expect(phase(ev, new Date("2026-11-23T21:30:00Z")).phase).toBe("lead");
    expect(phase(ev, new Date("2026-11-23T23:00:00Z")).phase).toBe("hour");
    expect(phase(ev, new Date("2026-11-23T22:59:00Z")).phase).toBe("lead");
    expect(phase(ev, new Date("2026-11-23T23:50:00Z")).phase).toBe("hour");
    expect(phase(ev, new Date("2026-11-24T00:00:00Z")).phase).toBe("live");
    expect(phase(ev, new Date("2026-11-24T00:14:00Z")).phase).toBe("live");
    expect(phase(ev, new Date("2026-11-24T00:15:00Z")).phase).toBe("last");
    expect(phase(ev, new Date("2026-11-24T01:30:00Z")).phase).toBe("ended");
    expect(leadLabel(180)).toBe("3 hours");
    expect(leadLabel(90)).toBe("90 minutes");
  });
});

describe("pkpass", () => {
  it("builds a signed pass with colon offsets", () => {
    const dir = process.env.WALLET_TEST_DIR;
    if (!dir) return;
    process.env.WALLET_PASS_TYPE_ID = process.env.WALLET_REAL ? "pass.com.koconsultings.events" : "pass.com.test.events";
    process.env.WALLET_CERT_PEM = readFileSync(`${dir}/c.pem`, "utf8");
    process.env.WALLET_KEY_PEM = readFileSync(`${dir}/k.pem`, "utf8");
    const json = JSON.stringify(passJson(ev, "abc123abc123", "tok"));
    expect(json).not.toMatch(/\+0000"/);
    const { body } = buildPkpass(ev, "abc123abc123", "tok");
    writeFileSync(`${dir}/test.pkpass`, body);
  });
});

describe("last modified", () => {
  it("is never in the future, even across a skipped week", async () => {
    const { previousSessionEnd } = await import("./schedule");
    const now = new Date("2026-11-05T22:00:00Z");
    expect(previousSessionEnd(ev, now).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
