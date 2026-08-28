import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPLOAD_BASE = process.env.KIE_UPLOAD_BASE || "https://kieai.redpandaai.co";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Host one photo so KIE can read it, and return the URL.
 *
 * Takes the file as multipart. The version this replaced took a JSON `{url}`
 * and base64'd it — which meant the browser had to already have the photo on
 * a public URL, and it never could: these come straight off the agent's disk.
 *
 * Streams the file through as multipart rather than base64 in JSON. Base64 is
 * a third larger and this runs on a serverless function with a request-size
 * ceiling, so the cheap encoding is the one that survives a 20-photo reel.
 */
export async function POST(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const key = process.env.KIE_API_KEY;
    if (!key) {
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file supplied" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `${file.name} is larger than 25MB` },
        { status: 413 }
      );
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: `${file.name} is a ${file.type}; use JPEG, PNG or WebP` },
        { status: 415 }
      );
    }

    const out = new FormData();
    out.append("file", file, file.name || "photo.jpg");
    out.append("uploadPath", "homereel/photos");

    const res = await fetch(`${UPLOAD_BASE}/api/file-stream-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
      signal: AbortSignal.timeout(50_000),
    });

    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    const data = (json as { data?: { downloadUrl?: string; fileUrl?: string; url?: string } }).data;
    const url = data?.downloadUrl || data?.fileUrl || data?.url;

    if (!res.ok || !url) {
      const msg =
        (json as { msg?: string; message?: string }).msg ??
        (json as { message?: string }).message ??
        `upload returned ${res.status}`;
      console.error("[kie/upload]", file.name, msg);
      return NextResponse.json({ ok: false, error: `Could not host ${file.name}: ${msg}` }, { status: 502 });
    }

    // `url` is the field the wizard reads. Kept flat and predictable.
    return NextResponse.json({ ok: true, url, name: file.name, bytes: file.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[kie/upload]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
