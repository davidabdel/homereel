import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

// Fetch a freshly generated asset from the provider (KIE) and store a durable
// copy in the private 'media' bucket, so downloads keep working after the
// provider's temporary URL expires.
export async function POST(req: Request) {
  try {
    const auth = await getRouteUser();
    if (!auth) return unauthorized();
    const { user, supabase } = auth;

    const { url, projectId, type } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ ok: false, error: "Missing or invalid url" }, { status: 400 });
    }
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 });
    }

    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Could not fetch asset (${res.status})` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());

    const ext =
      type === "video" || contentType.includes("mp4")
        ? "mp4"
        : contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
            ? "webp"
            : contentType.includes("jpeg") || contentType.includes("jpg")
              ? "jpg"
              : type === "image"
                ? "png"
                : "bin";

    const path = `${user.id}/${projectId}.${ext}`;
    const { error } = await supabase.storage
      .from("media")
      .upload(path, buf, { contentType, upsert: true });

    if (error) {
      console.error("media store upload error:", error.message);
      return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
