/**
 * The generation layer: prompts, the Hailuo call, and the shot plan.
 *
 * The accuracy rules live here rather than in the UI, because they are the
 * product. A shot that invents a room is worth less than no shot at all — it's
 * the agent's licence on the listing, not ours.
 */

import { MODELS, VIDEO_DURATION_SECONDS, type Quality } from "./pricing";

const KIE_BASE = process.env.KIE_API_BASE ?? "https://api.kie.ai";

/* ------------------------------------------------------------------ prompt */

/**
 * Zero scene nouns, deliberately. Naming nothing in the room makes it
 * impossible for the model to name something that isn't there. This wording
 * took thirty clips to arrive at and is the reason structural invention went
 * to zero — do not "improve" it by describing the property.
 */
const SPINE_EMPTY =
  "Every surface, edge, window, wall, roofline and line in the scene stays fixed and unchanged, and " +
  "all existing lettering and numbering remains exactly as it is. Nothing is added and no part of " +
  "the building changes shape. Only foliage stirs in a light breeze.";

const SPINE_PEOPLE =
  "Every surface, edge, window, wall, cabinet, benchtop and line in the scene stays fixed and " +
  "unchanged, and no part of the room changes shape. Nothing is added. The people already in the " +
  "scene stay exactly where they are and move only naturally and subtly.";

/**
 * The model is only ever allowed two things: push in, or hold still.
 *
 * A move that *reveals* new area forces the model to answer "what is just off
 * the side of this frame", and it has nothing to answer with, so it invents —
 * a pond, a window, a second room. A move that only ever consumes area it can
 * already see cannot. That is the whole rule, and it is why the pans were the
 * shots coming back wrong while the pushes came back clean.
 *
 * So we no longer ask for a pan. The lateral move is done afterwards, in the
 * joiner, by zooming into the finished shot and sliding the window across it —
 * see `PAN_ZOOM`. Nothing outside the photograph can ever reach the screen.
 */
export const MOVES = {
  push:
    "Smooth cinematic dolly pushing steadily forward into the scene, continuous forward travel " +
    "that stops short of any doorway, gateway or opening and never passes through it. ",
  locked:
    "The camera is locked off on a tripod and does not move at all: no pan, no tilt, no zoom, no " +
    "dolly, no drift. The framing in the last frame is identical to the framing in the first. ",
} as const;

export type Move = keyof typeof MOVES;

/**
 * The lateral move, applied in post rather than asked of the model.
 *
 * `lr` slides the window left to right, `rl` right to left, `null` leaves the
 * shot alone. A push already has movement of its own and never takes a pan.
 */
export type Pan = "lr" | "rl" | null;

/**
 * How far in the post-pan zooms before it starts travelling.
 *
 * The zoom is what buys the travel: at 1/0.82 there is 18% of frame width to
 * slide through, which reads as a real pan over six seconds. Going tighter
 * gives more travel but upscales the shot harder, and this is already the
 * point where a 1080p shot stays sharp on a phone.
 */
export const PAN_ZOOM = 0.82;

export type ShotPlan = { move: Move; pan: Pan };

/** Cap on a reshoot note. Long enough to say what went wrong, short enough
 *  that it can't out-weigh the accuracy spine that follows it. */
export const MAX_NOTE_CHARS = 300;

export function cleanNote(note: unknown): string {
  if (typeof note !== "string") return "";
  return note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS);
}

/**
 * The agent's note goes *before* the accuracy spine, never after it.
 *
 * Whatever they type is a correction to the last attempt, not a licence to add
 * something. Putting it ahead of "nothing is added and no part of the room
 * changes shape" means the spine is still the last word in the prompt.
 */
export function buildPrompt(move: Move, withPeople: boolean, note = ""): string {
  const spine = withPeople ? SPINE_PEOPLE : SPINE_EMPTY;
  const people = withPeople
    ? " The people already in the scene continue what they are doing, calmly and naturally."
    : "";
  const clean = cleanNote(note);
  const correction = clean ? `Correcting the previous attempt: ${clean}. ` : "";
  const rig = move === "push" ? "smooth motorised dolly" : "locked-off tripod";
  return `${MOVES[move]}${correction}${spine}${people} Real estate cinematography, ${rig}, no text.`;
}

/* -------------------------------------------------------------- shot order */

/**
 * approach → arrive → live → retreat → land. It's the order you'd walk someone
 * through at an open home, because it's the order a person understands a house
 * in. Any other order reads as a slideshow with movement on it.
 */
export const SHOT_ORDER = ["approach", "arrive", "live", "retreat", "land"] as const;

/**
 * Alternate the move so a film doesn't feel like one long zoom.
 *
 * Same rhythm as before — push, left-to-right, right-to-left — except the two
 * lateral shots are now generated locked off and panned in post.
 */
export function planForIndex(i: number): ShotPlan {
  if (i % 3 === 0) return { move: "push", pan: null };
  return { move: "locked", pan: i % 3 === 1 ? "lr" : "rl" };
}

/* --------------------------------------------------------------- the call */

export type SubmitResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string; billed: false };

/**
 * Submit exactly one shot.
 *
 * A 422 costs nothing. A 200 bills at KIE on submit and cannot be recalled, so
 * the caller must never retry a shot that already came back with a task id.
 */
export async function submitShot(opts: {
  imageUrl: string;
  quality: Quality;
  move: Move;
  withPeople: boolean;
  /** A reshoot note, in the agent's words. Empty on a first attempt. */
  note?: string;
  callbackUrl?: string;
}): Promise<SubmitResult> {
  const key = process.env.KIE_API_KEY;
  if (!key) return { ok: false, error: "KIE_API_KEY not configured", billed: false };

  const m = MODELS[opts.quality];
  const body: Record<string, unknown> = {
    model: m.model,
    input: {
      prompt: buildPrompt(opts.move, opts.withPeople, opts.note),
      image_url: opts.imageUrl,
      duration: VIDEO_DURATION_SECONDS,
      resolution: m.resolution,
    },
  };
  if (opts.callbackUrl) body.callBackUrl = opts.callbackUrl;

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({} as any));

  if (!res.ok || json?.code !== 200 || !json?.data?.taskId) {
    return { ok: false, error: json?.msg || `KIE returned ${res.status}`, billed: false };
  }
  return { ok: true, taskId: json.data.taskId };
}

export type ShotState = {
  taskId: string;
  state: "waiting" | "generating" | "success" | "fail";
  url?: string;
  creditsConsumed?: number;
  failMsg?: string;
};

/** Standard envelope for both Hailuo tiers — no per-model special-casing. */
export async function pollShot(taskId: string): Promise<ShotState> {
  const key = process.env.KIE_API_KEY;
  if (!key) return { taskId, state: "fail", failMsg: "KIE_API_KEY not configured" };

  const res = await fetch(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  const json = await res.json().catch(() => ({} as any));
  const d = json?.data ?? {};

  if (d.state === "success") {
    let url: string | undefined;
    try {
      url = JSON.parse(d.resultJson || "{}")?.resultUrls?.[0];
    } catch {
      /* leave undefined — treated as still generating by the caller */
    }
    return { taskId, state: "success", url, creditsConsumed: d.creditsConsumed };
  }
  if (d.state === "fail") {
    return { taskId, state: "fail", failMsg: d.failMsg || "Generation failed" };
  }
  return { taskId, state: d.state === "generating" ? "generating" : "waiting" };
}
