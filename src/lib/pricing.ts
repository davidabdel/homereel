/**
 * Single source of truth for what a generation costs and which model runs it.
 *
 * Credits are our own unit — 1 credit = $0.01 of face value — and the agent never
 * sees a dollar figure inside the app. Changing a number here moves the upload
 * calculator, the ledger and the plan rows together; nothing else hardcodes a rate.
 */

export type Quality = "sd" | "hd";

/** What the agent is charged, in our credits. */
export const RATES = {
  /** One photo becomes one shot, so this is also the per-photo rate. */
  shot: { sd: 40, hd: 100 },
  /** Added per room the agent chooses to put a family in (one image edit). */
  familyRoom: 20,
  /** Included with the $19/month membership. Expires monthly. */
  monthlyIncluded: 1000,
} as const;

/**
 * Both Hailuo tiers take identical parameters — only the slug and the resolution
 * differ — so switching quality is a two-field change and nothing else.
 *
 * Hailuo's minimum duration is 6 seconds, not 5.
 */
export const MODELS = {
  sd: { model: "hailuo/2-3-image-to-video-standard", resolution: "768P" },
  hd: { model: "hailuo/2-3-image-to-video-pro", resolution: "1080P" },
} as const;

export const VIDEO_DURATION_SECONDS = "6" as const;

/** The image editor that paints the cast into a room. Already wired. */
export const IMAGE_EDIT_MODEL = "google/nano-banana-edit" as const;

/**
 * The three membership tiers.
 *
 * Every credit costs us at most $0.0076 (an HD shot is 100 credits at $0.61),
 * so the margin at 100% utilisation is 60% / 53% / 43% top to bottom. There is
 * no usage pattern on any tier that loses money — that's the property to keep
 * whenever these numbers change.
 */
export const PLANS = [
  {
    key: "starter",
    name: "HomeReel Starter",
    priceAud: 19,
    credits: 1000,
    blurb: "One HD reel a month, or two and a half in Standard.",
  },
  {
    key: "pro",
    name: "HomeReel Pro",
    priceAud: 49,
    credits: 3000,
    blurb: "Three HD reels a month. For an agent listing every week.",
  },
  {
    key: "extreme",
    name: "HomeReel Extreme",
    priceAud: 199,
    credits: 15000,
    blurb: "Fifteen HD reels a month. For an office, not a person.",
  },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

/**
 * Purchased top-ups. Dollar amounts appear at Stripe checkout only — never in
 * the app. These credits last 12 months; the monthly allowance does not.
 */
export const TOPUPS = [
  { priceAud: 20, credits: 1500 },
  { priceAud: 50, credits: 4000 },
  { priceAud: 100, credits: 8500 },
] as const;

/** The entry tier. Kept as a named export for anything that wants "the" plan. */
export const MEMBERSHIP = {
  priceAud: PLANS[0].priceAud,
  gstInclusive: true,
  creditsPerMonth: PLANS[0].credits,
} as const;

export const TOPUP_VALIDITY_MONTHS = 12;

/**
 * What a film will cost before the agent commits to it.
 *
 * `photoCount` is the shot count — one photo, one shot. `familyRooms` is how many of
 * those photos the agent asked to have people painted into.
 */
export function quoteFilm(
  photoCount: number,
  quality: Quality,
  familyRooms = 0
): { shots: number; familyRooms: number; credits: number } {
  const shots = Math.max(0, Math.floor(photoCount));
  const rooms = Math.min(Math.max(0, Math.floor(familyRooms)), shots);
  return {
    shots,
    familyRooms: rooms,
    credits: shots * RATES.shot[quality] + rooms * RATES.familyRoom,
  };
}
