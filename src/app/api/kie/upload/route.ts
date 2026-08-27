import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
}

function guessMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const { url, fileName } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
    }

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_UPLOAD_BASE = env("KIE_UPLOAD_BASE") || "https://kieai.redpandaai.co"; // per docs
    if (!KIE_API_KEY) {
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    let dataUrl: string | null = null;
    let finalFileName = fileName || path.basename(url) || "upload.png";

    if (/^https?:\/\//i.test(url)) {
      // Remote HTTP URL: fetch and convert to data URL
      const r = await fetch(url);
      if (!r.ok) return NextResponse.json({ ok: false, error: `Fetch failed ${r.status}` }, { status: 502 });
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") || guessMime(finalFileName);
      dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      if (!path.extname(finalFileName)) {
        // Try to set extension from mime
        if (mime.includes("png")) finalFileName += ".png";
        else if (mime.includes("jpeg") || mime.includes("jpg")) finalFileName += ".jpg";
        else if (mime.includes("webp")) finalFileName += ".webp";
      }
    } else {
      // Local path like /Images/buzz.png -> resolve to public
      const rel = url.startsWith("/") ? url.slice(1) : url;
      const abs = path.join(process.cwd(), "public", rel);
      if (!fs.existsSync(abs)) {
        return NextResponse.json({ ok: false, error: `Local file not found: ${abs}` }, { status: 404 });
      }
      const buf = fs.readFileSync(abs);
      const mime = guessMime(finalFileName || abs);
      dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      if (!finalFileName) finalFileName = path.basename(abs);
    }

    // Upload to KIE File Upload (base64)
    const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Data: dataUrl,
        uploadPath: "images/user-uploads",
        fileName: finalFileName,
      }),
    });
    const upJson: any = await upRes.json().catch(() => ({}));
    if (!upRes.ok || !(upJson?.success || upJson?.code === 200)) {
      return NextResponse.json({ ok: false, error: `Upload failed ${upRes.status}`, raw: upJson }, { status: 502 });
    }
    const uploadedUrl: string | undefined = upJson?.data?.downloadUrl || upJson?.data?.url;
    if (!uploadedUrl) {
      return NextResponse.json({ ok: false, error: "No downloadUrl in upload response", raw: upJson }, { status: 502 });
    }

    return NextResponse.json({ ok: true, uploadedUrl, info: upJson?.data || {} });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
