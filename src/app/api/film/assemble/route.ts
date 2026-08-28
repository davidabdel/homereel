import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRouteUser, unauthorized, rateLimit } from "@/lib/api-guard";
import { putObject, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOINER_URL = process.env.JOINER_URL ?? "";
const CROSSFADE = 0.3;

/**
 * Join the shots the agent approved into one reel and store it.
 *
 * The joining itself runs on Cloud Run because ffmpeg needs a real binary and
 * a filesystem, and this function has neither. This route is the errand boy:
 * it hands over the approved URLs, takes back an mp4, and puts it in R2.
 *
 * Nothing here charges credits. The shots were paid for when they generated —
 * assembling what you already own is free, and re-assembling after changing
 * your mind about which shots to keep should be free too.
 */
export async function POST(req: Request) {
  try {
    const auth = await getRouteUser();
    if (!auth) return unauthorized();

    if (!JOINER_URL) {
      return NextResponse.json(
        { ok: false, error: "The reel builder isn't configured yet." },
        { status: 503 }
      );
    }
    if (!r2Configured) {
      return NextResponse.json(
        { ok: false, error: "Storage isn't configured yet." },
        { status: 503 }
      );
    }

    // Assembling is cheap but not free — it holds a container for ~20s.
    if (!rateLimit(`assemble:${auth.user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { ok: false, error: "Too many reels in the last hour. Try again shortly." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const shots: string[] = Array.isArray(body?.shots) ? body.shots : [];
    if (shots.length === 0) {
      return NextResponse.json({ ok: false, error: "No approved shots" }, { status: 400 });
    }
    if (shots.some((s) => typeof s !== "string" || !/^https?:\/\//i.test(s))) {
      return NextResponse.json({ ok: false, error: "Every shot must be a URL" }, { status: 400 });
    }

    const joined = await fetch(`${JOINER_URL.replace(/\/+$/, "")}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shots, crossfade: CROSSFADE, grade: true }),
      // A cold Cloud Run container plus a 15-shot join needs real headroom.
      signal: AbortSignal.timeout(280_000),
    });

    if (!joined.ok) {
      const detail = await joined.text().catch(() => "");
      throw new Error(`Reel builder returned ${joined.status}: ${detail.slice(0, 200)}`);
    }

    const mp4 = Buffer.from(await joined.arrayBuffer());
    if (mp4.byteLength < 1024) throw new Error("Reel builder returned an empty file");

    // Namespaced by user so one agent's reels can never collide with another's.
    const key = `reels/${auth.user.id}/${randomUUID()}.mp4`;
    const url = await putObject(key, mp4, "video/mp4");

    return NextResponse.json({
      ok: true,
      url,
      bytes: mp4.byteLength,
      shots: shots.length,
      seconds: Number(joined.headers.get("x-join-seconds") ?? 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[assemble]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
