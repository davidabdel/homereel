import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
    }

    // Support data URLs directly
    if (/^data:/i.test(url)) {
      try {
        const [, meta, b64] = url.match(/^data:([^,]*),(.*)$/i) || [];
        const isBase64 = /;base64/i.test(meta || "");
        const mime = (meta || "").replace(/;base64/i, "") || "application/octet-stream";
        const data = isBase64 ? Buffer.from(b64, "base64") : Buffer.from(decodeURIComponent(b64), "utf8");
        return new NextResponse(data, {
          status: 200,
          headers: { "Content-Type": mime, "Cache-Control": "no-cache" },
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || "Invalid data URL" }, { status: 400 });
      }
    }

    // Fetch remote URL; allow redirects
    const res = await fetch(url, { redirect: "follow" });
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Upstream error ${res.status}`, contentType }, { status: 502 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
