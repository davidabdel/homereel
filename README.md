# HomeReel

Listing films from photos an agent already has. Every photo becomes a moving
shot; the shots join into one film. No camera, no crew, no site visit — and
nothing on screen that isn't in the house.

Forked from the UnrealAdz (UGC) codebase for the plumbing — auth, projects,
media storage, Stripe billing and the credit ledger — then rebuilt around
property.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` already contains `NEXT_PUBLIC_DEMO=1`, which is the whole point:
**you can click through the entire app with no Supabase, Stripe or KIE
credentials.** Auth is bypassed, the balance reads 1,000 credits, and step 4
doesn't spend anything.

Worth a look, in order:

| Page | What to check |
|---|---|
| `/` | The rebrand. No logo strip, no CTR claim, real property clips in the showcase |
| `/pricing` | One $19 membership and three top-ups |
| `/app/create` | The four steps, then the approve screen |

To run it for real, add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
KIE_API_KEY=…
KIE_CALLBACK_URL=…            # optional; polling works without it
STRIPE_SECRET_KEY=…
STRIPE_WEBHOOK_SECRET=…
```

…and remove `NEXT_PUBLIC_DEMO`. Then apply
`supabase/migrations/0004_homereel_wallet.sql`.

---

## How the money works

`src/lib/pricing.ts` is the only place rates are defined. Change a number there
and the upload calculator, the ledger and the plan rows all follow.

| | credits | KIE cost | markup |
|---|---|---|---|
| HD shot (1080p) | 100 | $0.61 | 1.6× |
| Standard shot (768p) | 40 | $0.23 | 1.8× |
| Family in a room | +20 | $0.09 | 2.2× |

Membership is **$19/month, GST inclusive, 1,000 credits**. A ten-shot HD film is
exactly 1,000 credits, so the membership covers one a month. Monthly credits
expire monthly; purchased top-ups last 12 months and are spent second, so the
perishable bucket always drains first.

Worst case — a member spends every credit on HD — is $19 in against $6.08 of
KIE spend. **No usage pattern loses money.** That is the difference between this
and the tiered allowance it replaced, where $99 bought 714 videos.

### Why reservations exist

A film is N shots and therefore N separate `createTask` calls, each of which
bills at KIE the moment it returns 200 and cannot be recalled. So:

1. `reserve_credits` holds the whole film's cost before anything is submitted
2. shots are submitted in parallel, one `createTask` each, never retried
3. `settle_credits` on success, `release_credits` on failure

A shot that fails costs nothing at KIE, so it must cost the agent nothing.

---

## The accuracy rules

These are the product, not a preference — it's the agent's licence on the
listing. They live in `src/lib/film.ts` and in the step 3 UI.

- **The prompt names no scene nouns.** Naming nothing in the room makes it
  impossible for the model to name something that isn't there. Don't "improve"
  it by describing the property.
- **Safe moves: pan and push-in only.** A move that reveals new area forces
  invention; one that consumes area can't. Never rise, pull back or orbit.
- **People go only where they're doing something** — kitchen, dining, living,
  outdoor dining. Those four are the entire list in the UI, which is the
  enforcement: bathrooms, laundries, robes, pantries and exteriors are never
  offered, so they can't be picked by accident.
- **Every shot is shown beside the photograph it came from** and has to be
  approved before it enters the film.

---

## What changed from the fork

Removed: persona generation and upload, hook/dialogue writing, the UGC ad
framing, `veo3_fast` and Veo's custom envelope, the customer logo strip, and the
"2.7× AVG CTR LIFT" claim. No performance claim replaced it — there is no
verified figure for video lifting enquiry or price.

Added: `pricing.ts`, `film.ts`, the four-step wizard, the approve screen, the
two-bucket wallet migration, and per-shot reserve/settle/release.

Kept: the neo-brutalist design system in full, Supabase auth, projects, media
storage, the Stripe webhook, and `nano-banana-edit` — which is already the
image editor the family-in-a-room feature needs.

## Still to build

- `api/film/assemble` — ffmpeg join with 0.3s dissolves, approved shots only
- Wiring the family edit (`nano-banana-edit`) into step 3's chosen rooms
- Reshoot button on the approve screen (UI is there, handler isn't)
- Stripe products for the $19 membership and the three top-ups
- Storing shots to `project_shots` (migration is written, routes don't write yet)
