import http2 from "node:http2";
import { passTypeId } from "./config";

/**
 * Wakes installed passes. APNs over HTTP/2 with the Pass Type ID certificate
 * as the client certificate; the payload is an empty object. The device then
 * re-fetches the pass, and shows an alert only if a field with a
 * changeMessage actually changed.
 */
export async function pushToDevices(tokens: string[]): Promise<{ sent: number; gone: string[]; failed: number }> {
  const unique = [...new Set(tokens)].filter(Boolean);
  if (!unique.length) return { sent: 0, gone: [], failed: 0 };
  const cert = (process.env.WALLET_CERT_PEM ?? "").replace(/\\n/g, "\n");
  const key = (process.env.WALLET_KEY_PEM ?? "").replace(/\\n/g, "\n");
  const client = http2.connect("https://api.push.apple.com", { cert, key });
  const topic = passTypeId();
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  try {
    await Promise.all(
      unique.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              "apns-topic": topic,
              "content-type": "application/json",
            });
            req.setTimeout(10000, () => {
              failed++;
              req.close();
              resolve();
            });
            req.on("response", (headers) => {
              const status = Number(headers[":status"]);
              if (status === 200) sent++;
              else if (status === 410) gone.push(token);
              else failed++;
            });
            req.on("error", () => {
              failed++;
              resolve();
            });
            req.on("close", () => resolve());
            req.resume();
            req.end("{}");
          })
      )
    );
  } finally {
    client.close();
  }
  return { sent, gone, failed };
}
