import { NextResponse } from "next/server";
import { getRouteUser, unauthorized, rateLimit, reserveCredits, releaseCredits } from "@/lib/api-guard";
import { RATES, quoteFilm, type Quality } from "@/lib/pricing";
import { moveForIndex, submitShot } from "@/lib/film";

export const runtime = "nodejs";

type IncomingPhoto = { url: string; withPeople?: boolean };

/**
 * Submit a whole film: one createTask per photo.
 *
 * Order of operations matters and is not negotiable:
 *   1. reserve every credit the film could cost
 *   2. submit the shots
 *   3. release the hold for any shot that never reached KIE
 *
 * A shot whose createTask returns 200 has already billed and cannot be
 * recalled, so nothing here ever retries a shot that came back with a task id.
 */
export async function POST(req: Request) {
  try {
    const auth = await getRouteUser();
    if (!auth) return unauthorized();

    // Limit whole films per hour, not shots. A twenty-photo film is twenty
    // calls and would trip a per-shot limiter on its first run.
    if (!rateLimit(`film:${auth.user.id}`, 12, 60 * 60 * 1000)) {
      return NextResponse.json(
        { ok: false, error: "You've started a lot of films in the last hour. Try again shortly." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const photos: IncomingPhoto[] = Array.isArray(body?.photos) ? body.photos : [];
    const quality: Quality = body?.quality === "hd" ? "hd" : "sd";
    const projectId: string | undefined = body?.projectId;

    if (photos.length === 0) {
      return NextResponse.json({ ok: false, error: "No photos supplied" }, { status: 400 });
    }
    if (photos.some((p) => typeof p?.url !== "string" || !/^https?:\/\//i.test(p.url))) {
      return NextResponse.json({ ok: false, error: "Every photo needs a hosted URL" }, { status: 400 });
    }

    const familyRooms = photos.filter((p) => p.withPeople).length;
    const quote = quoteFilm(photos.length, quality, familyRooms);

    // 1. hold the credits for the whole film up front
    const held = await reserveCredits(
      auth.supabase,
      quote.credits,
      `Film reservation — ${quote.shots} ${quality.toUpperCase()} shots`
    );
    if (!held.success) {
      return NextResponse.json(
        { ok: false, error: held.message || "Insufficient credits", required: quote.credits, available: held.available },
        { status: 402 }
      );
    }

    // 2. submit. Each shot's own rate is what gets released if it never lands.
    const perShot = RATES.shot[quality];
    const callbackUrl = process.env.KIE_CALLBACK_URL;
    const results = await Promise.all(
      photos.map(async (photo, i) => {
        const withPeople = Boolean(photo.withPeople);
        const move = moveForIndex(i);
        const r = await submitShot({ imageUrl: photo.url, quality, move, withPeople, callbackUrl });
        return {
          position: i,
          sourceUrl: photo.url,
          withPeople,
          move,
          creditsHeld: perShot + (withPeople ? RATES.familyRoom : 0),
          ...(r.ok
            ? { taskId: r.taskId, state: "generating" as const }
            : { state: "fail" as const, failMsg: r.error }),
        };
      })
    );

    // 3. nothing was billed for shots that never reached KIE — give those back
    const unsubmitted = results.filter((s) => s.state === "fail");
    const refund = unsubmitted.reduce((n, s) => n + s.creditsHeld, 0);
    if (refund > 0) {
      await releaseCredits(auth.supabase, refund, `${unsubmitted.length} shot(s) not submitted`);
    }

    const submitted = results.filter((s) => s.state !== "fail");
    if (submitted.length === 0) {
      const firstReason = unsubmitted.find((s) => "failMsg" in s && s.failMsg);
      const reason =
        firstReason && "failMsg" in firstReason ? firstReason.failMsg : "No shots could be submitted";
      return NextResponse.json({ ok: false, error: reason, shots: results }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      projectId,
      quality,
      creditsHeld: quote.credits - refund,
      shots: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
