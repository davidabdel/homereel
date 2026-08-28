/**
 * R2 storage — SigV4 signed against Cloudflare's S3 endpoint.
 *
 * Hand-rolled rather than pulling in the AWS SDK: this needs exactly one verb
 * (PUT an object) and the SDK is a large dependency for that. R2 is the right
 * home for finished reels because it charges nothing for egress, and serving
 * video is the whole job.
 */

import { createHash, createHmac } from "node:crypto";

const ACCOUNT = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET = process.env.R2_BUCKET ?? "";
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

export const r2Configured = Boolean(ACCOUNT && ACCESS_KEY && SECRET && BUCKET && PUBLIC_BASE);

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const hmac = (key: Buffer | string, msg: string) => createHmac("sha256", key).update(msg).digest();

/**
 * Store an object and return the public URL it will be served from.
 *
 * `key` must not start with a slash. Objects are content-addressed by the
 * caller, not here — this deliberately overwrites, so a retried assemble
 * doesn't leave orphans behind.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!r2Configured) throw new Error("R2 is not configured");

  const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
  const path = `/${BUCKET}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const headers: Record<string, string> = {
    "content-type": contentType,
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h]}\n`)
    .join("");

  const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const res = await fetch(`https://${host}${path}`, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return `${PUBLIC_BASE}/${key}`;
}
