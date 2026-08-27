import { NextResponse } from "next/server";
import { getRouteUser, unauthorized, settleCredits, releaseCredits } from "@/lib/api-guard";
import { pollShot } from "@/lib/film";

export const runtime = "nodejs";

type Watched = { taskId: string; creditsHeld: number; settled?: boolean };

/**
 * Poll a film's shots and settle the ledger as each one lands.
 *
 * Both Hailuo tiers use the standard envelope, so there is no per-model
 * endpoint guessing here — the old Veo path tried nine URLs in turn because
 * Veo has its own poll route and a JSON-string result field. That's gone.
 *
 * The client passes `settled` back for shots it has already been told about,
 * so a shot is only ever charged or refunded once.
 */
export async function POST(req: Request) {
  try {
    const auth = await getRouteUser();
    if (!auth) return unauthorized();

    const body = await req.json().catch(() => null);
    const watched: Watched[] = Array.isArray(body?.shots) ? body.shots : [];
    if (watched.length === 0) {
      return NextResponse.json({ ok: false, error: "No shots to poll" }, { status: 400 });
    }

    const shots = await Promise.all(
      watched.map(async (w) => {
        if (typeof w?.taskId !== "string" || !w.taskId) {
          return { taskId: "", state: "fail" as const, failMsg: "Missing task id", settled: true };
        }
        const s = await pollShot(w.taskId);
        const held = Math.max(0, Number(w.creditsHeld) || 0);

        // Only touch the ledger on the transition into a terminal state.
        if (!w.settled && held > 0) {
          if (s.state === "success") {
            await settleCredits(auth.supabase, held, `Shot generated (${w.taskId})`);
          } else if (s.state === "fail") {
            // Costs nothing at KIE, so it costs the agent nothing.
            await releaseCredits(auth.supabase, held, `Shot failed (${w.taskId})`);
          }
        }

        const terminal = s.state === "success" || s.state === "fail";
        return { ...s, settled: w.settled || terminal };
      })
    );

    const done = shots.every((s) => s.state === "success" || s.state === "fail");
    return NextResponse.json({
      ok: true,
      done,
      succeeded: shots.filter((s) => s.state === "success").length,
      failed: shots.filter((s) => s.state === "fail").length,
      shots,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
