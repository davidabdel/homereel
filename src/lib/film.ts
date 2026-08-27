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
 * Only two moves are safe. A move that *reveals* new area forces the model to
 * invent what's there; a move that consumes area cannot. Never rise, pull back
 * or orbit — and a pan is only safe square-on to an elevation, because a
 * lateral move past an angled facade is an orbit by another name.
 */
export const MOVES = {
  push:
    "Smooth cinematic dolly pushing steadily forward into the scene, continuous forward travel " +
    "that stops short of any doorway, gateway or opening and never passes through it. ",
  panLR:
    "Smooth cinematic camera pan travelling from left to right through the space, a steady " +
    "continuous horizontal move with clear lateral travel. ",
  panRL:
    "Smooth cinematic camera pan travelling from right to left across the front of the property, a " +
    "steady continuous horizontal move with clear lateral travel and real parallax. ",
} as const;

export type Move = keyof typeof MOVES;

export function buildPrompt(move: Move, withPeople: boolean): string {
  const spine = withPeople ? SPINE_PEOPLE : SPINE_EMPTY;
  const people = withPeople
    ? " The people already in the scene continue what they are doing, calmly and naturally."
    : "";
  const rig = move === "push" ? "smooth motorised dolly" : "smooth motorised slider";
  return `${MOVES[move]}${spine}${people} Real estate cinematography, ${rig}, no text.`;
}

/* -------------------------------------------------------------- shot order */

/**
 * approach → arrive → live → retreat → land. It's the order you'd walk someone
 * through at an open home, because it's the order a person understands a house
 * in. Any other order reads as a slideshow with movement on it.
 */
export const SHOT_ORDER = ["approach", "arrive", "live", "retreat", "land"] as const;

/** Alternate the move so a film doesn't feel like one long zoom. */
export function moveForIndex(i: number): Move {
  if (i % 3 === 0) return "push";
  return i % 3 === 1 ? "panLR" : "panRL";
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
  callbackUrl?: string;
}): Promise<SubmitResult> {
  const key = process.env.KIE_API_KEY;
  if (!key) return { ok: false, error: "KIE_API_KEY not configured", billed: false };

  const m = MODELS[opts.quality];
  const body: Record<string, unknown> = {
    model: m.model,
    input: {
      prompt: buildPrompt(opts.move, opts.withPeople),
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
