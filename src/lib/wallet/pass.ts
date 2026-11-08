import { createHash } from "node:crypto";
import forge from "node-forge";
import { WALLET_ASSETS } from "./assets";
import { WALLET_BASE_URL, WALLET_TEAM_ID, passTypeId, type WalletEvent } from "./config";
import { phase, statusText, w3c } from "./schedule";
import { WWDR_G4_PEM } from "./wwdr";
import { zip } from "./zip";

/** The pass.json for one registrant, as of `now`. */
export function passJson(ev: WalletEvent, serial: string, authToken: string, now = new Date()) {
  const ph = phase(ev, now);
  const statusField = { key: "status", label: "STATUS", value: statusText(ev, ph.phase), changeMessage: "%@", textAlignment: "PKTextAlignmentRight" };
  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId(),
    teamIdentifier: WALLET_TEAM_ID,
    // organizationName is the title iOS prints on the lock-screen card.
    organizationName: ev.name,
    description: ev.name,
    serialNumber: serial,
    logoText: ev.brand,
    backgroundColor: ev.colors.background,
    foregroundColor: ev.colors.foreground,
    labelColor: ev.colors.label,
    // The real start time: iOS prints it on the card.
    relevantDate: w3c(ph.start),
    relevantDates: [{ startDate: w3c(new Date(ph.start.getTime() - 24 * 3600e3)), endDate: w3c(ph.end) }],
    // A standing weekly ticket: keep it valid past next week's roll.
    expirationDate: w3c(new Date(ph.end.getTime() + 8 * 864e5)),
    sharingProhibited: true,
    webServiceURL: WALLET_BASE_URL,
    authenticationToken: authToken,
    barcodes: [{ format: "PKBarcodeFormatQR", message: ev.joinUrl, messageEncoding: "iso-8859-1", altText: "Scan to join" }],
    eventTicket: {
      headerFields: [
        {
          key: "starts",
          label: "STARTS",
          value: w3c(ph.start),
          dateStyle: "PKDateStyleMedium",
          timeStyle: "PKDateStyleShort",
          changeMessage: "Next session: %@",
        },
      ],
      primaryFields: [],
      secondaryFields: [
        { key: "seat", label: "YOUR SEAT", value: "Reserved" },
        { key: "access", label: "ACCESS", value: ev.access, textAlignment: "PKTextAlignmentRight" },
      ],
      auxiliaryFields: [
        // Front-of-pass text cannot be a link (user wording 2026-11-06).
        { key: "join", label: "HOW TO JOIN", value: "The Link Is In Your Email!" },
        ev.timeOnFront
          ? { key: "time", label: "TIME", value: timeLabel(ev, ph.start), textAlignment: "PKTextAlignmentRight" }
          : statusField,
      ],
      backFields: [
        {
          key: "join_full",
          label: "JOIN LINK",
          value: ev.joinUrl,
          attributedValue: `<a href='${ev.joinUrl}'>Tap to join the masterclass</a>`,
        },
        { key: "live", label: "LIVE ONLY", value: "There is no replay. Show up live to get your questions answered." },
        // Kept on the back when the front shows the time, so the reminder alerts still come through.
        ...(ev.timeOnFront ? [{ ...statusField, textAlignment: undefined }] : []),
      ],
    },
  };
}

/** "7:00 PM EST": start time with the zone abbreviation, in the event's own timezone. */
export function timeLabel(ev: WalletEvent, start: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: ev.timeZone, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).format(start);
}

/** Last-Modified for a pass: when its current content took effect. */
export function passUpdatedAt(ev: WalletEvent, now = new Date()): Date {
  const s = Math.max(phase(ev, now).since.getTime(), Date.parse(PASS_DESIGN_UPDATED));
  return new Date(Math.floor(s / 1000) * 1000);
}

/**
 * Bump this (to the current time) whenever the pass layout or wording changes,
 * so installed passes pick up the new version on their next refresh.
 */
export const PASS_DESIGN_UPDATED = "2026-11-08T19:16:00Z";

function certMaterial() {
  const cert = process.env.WALLET_CERT_PEM;
  const key = process.env.WALLET_KEY_PEM;
  if (!cert || !key) throw new Error("Missing WALLET_CERT_PEM / WALLET_KEY_PEM");
  return { cert: cert.replace(/\\n/g, "\n"), key: key.replace(/\\n/g, "\n") };
}

/** Detached PKCS#7 signature of manifest.json, the shape Apple expects. */
function sign(manifest: Buffer): Buffer {
  const { cert, key } = certMaterial();
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  const signer = forge.pki.certificateFromPem(cert);
  p7.addCertificate(signer);
  p7.addCertificate(forge.pki.certificateFromPem(WWDR_G4_PEM));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: signer,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/** Build the signed .pkpass and the hash of its pass.json (for ETags). */
export function buildPkpass(ev: WalletEvent, serial: string, authToken: string, now = new Date()) {
  const json = Buffer.from(JSON.stringify(passJson(ev, serial, authToken, now)), "utf8");
  const files: { name: string; data: Buffer }[] = [{ name: "pass.json", data: json }];
  const art = WALLET_ASSETS[ev.assets] ?? {};
  for (const [name, b64] of Object.entries(art)) files.push({ name, data: Buffer.from(b64, "base64") });
  const manifest: Record<string, string> = {};
  for (const f of files) manifest[f.name] = createHash("sha1").update(f.data).digest("hex");
  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");
  files.push({ name: "manifest.json", data: manifestBuf });
  files.push({ name: "signature", data: sign(manifestBuf) });
  return { body: zip(files), hash: createHash("sha1").update(json).digest("hex") };
}

export const PKPASS_TYPE = "application/vnd.apple.pkpass";
