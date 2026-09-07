"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getUserCredits } from "@/lib/subscription-service";
import { RATES, quoteFilm, type Quality } from "@/lib/pricing";
import { prepareForUpload, mb } from "@/lib/photo-prep";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

/**
 * The only rooms people are ever allowed into.
 *
 * Bathrooms, laundries, robes and pantries aren't on this list and there is no
 * "other" — that's the enforcement. Exteriors aren't here either: a family on
 * a front lawn reads as an advertisement and the house disappears behind them.
 * People go where they are *doing* something.
 */
const PEOPLE_ROOMS = ["Kitchen", "Dining", "Living", "Outdoor dining"] as const;
type PeopleRoom = (typeof PEOPLE_ROOMS)[number];

/**
 * Two thresholds, not one.
 *
 * Below MIN_EDGE a photo is genuinely unusable — it would be soft even at
 * Standard. Between MIN_EDGE and HD_MIN_EDGE it makes a fine 768p reel but
 * would have to be upscaled for 1080p, which looks soft on a big screen. So
 * those are accepted and the reel is held to Standard rather than rejected:
 * a portal export at 816px is a normal thing for an agent to have.
 */
const MIN_EDGE = 600;
const HD_MIN_EDGE = 1000;

type Photo = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  /** False when the short edge is under HD_MIN_EDGE — 1080p would be upscaled. */
  hdCapable: boolean;
  room?: PeopleRoom;
  withPeople: boolean;
};

type Shot = {
  position: number;
  sourceUrl: string;
  /** KIE task. Absent when the shot never reached KIE, so nothing was billed. */
  taskId?: string;
  /** Held against this shot, released by the server if it fails. */
  creditsHeld: number;
  /** Set once the server has charged or refunded it, so it only happens once. */
  settled?: boolean;
  state: "generating" | "success" | "fail";
  resultUrl?: string;
  failMsg?: string;
  approved: boolean;
  /**
   * Deliberately dropped. Distinct from "not approved yet", which is the state
   * every shot starts in — without it the counter can't tell an agent who has
   * finished checking from one who has twelve shots still to look at.
   */
  ignored: boolean;
  /** The camera move this shot was generated with, so a reshoot keeps it. */
  move?: "push" | "locked";
  /** The post-pan applied when the reel is assembled. */
  pan?: "lr" | "rl" | null;
  /** Carried so a reshoot doesn't quietly lose the people in the room. */
  withPeople: boolean;
  /** When this shot was handed to KIE. Only used to drive the rendering bar. */
  startedAt: number;
};

/** A photo that made it onto KIE and is ready to be shot. */
type Ready = { url: string; withPeople: boolean; hdCapable: boolean };

/** A photo that didn't, and the reason in words rather than a status code. */
type UploadFailure = { name: string; reason: string };

/**
 * Say what actually went wrong with an upload.
 *
 * A 413 never reaches our own route — Vercel rejects the body at the edge and
 * answers in plain text — so there is no server message to pass on and this
 * has to supply one. "Could not upload IMG_7885.jpeg (413)" told nobody
 * anything, least of all which photo to swap.
 */
function describeUploadFailure(status: number, bytes: number): string {
  // Don't assert why it was refused. Stating the size we actually sent is true
  // whatever the reason, and reads sanely even when a 413 turns up on a small
  // file — "still 0.3 MB after resizing" would just be nonsense.
  if (status === 413) return `the server refused it as too large — sent ${mb(bytes)}`;
  if (status === 415) return "not a JPEG, PNG or WebP";
  if (status === 401) return "you were signed out — sign in and try again";
  if (status === 429) return "too many uploads at once — wait a moment and retry";
  if (status >= 500) return `the server didn't answer (${status})`;
  return `upload failed (${status})`;
}

/** What a shot usually takes. Not a promise — the bar never sits full on it. */
const EXPECTED_RENDER_MS = 180_000;

/** Mirrors MAX_NOTE_CHARS in src/lib/film.ts. Kept local so the KIE module,
 *  which reads server-only env at import time, stays out of the client bundle. */
const MAX_NOTE = 300;

/* ------------------------------------------------------------- primitives */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-[3px] border-[#131118] bg-[#F1EEE3] p-7 shadow-[8px_8px_0_#131118]">{children}</div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = "dark",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "dark" | "lime" | "ghost";
}) {
  const base =
    "inline-block border-[3px] border-[#131118] px-7 py-3.5 text-[16px] font-extrabold uppercase tracking-[0.03em] transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const tones = {
    dark: "bg-[#131118] text-[#F1EEE3] hover:bg-[#6E2CF4]",
    lime: "bg-[#D8FF3E] text-[#131118] hover:bg-[#6E2CF4] hover:text-[#F1EEE3]",
    ghost: "bg-transparent text-[#131118] hover:bg-[#D8FF3E]",
  } as const;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tones[tone]}`}>
      {children}
    </button>
  );
}

/**
 * The rendering bar.
 *
 * A shot takes about three minutes and KIE gives back nothing about how far
 * through it is, so this is deliberately honest about what it is: a clock with
 * a bar attached, not a measurement. It walks to 90% across the expected three
 * minutes and then crawls, so it can never read full while the shot is still
 * going. The stripes march on their own — that's the bit that says the app
 * hasn't died, which is the whole complaint this answers.
 */
function RenderProgress({ elapsedMs }: { elapsedMs: number }) {
  const t = Math.max(0, elapsedMs);
  const over = t > EXPECTED_RENDER_MS;
  const pct = over
    ? 90 + 9 * (1 - Math.exp(-(t - EXPECTED_RENDER_MS) / EXPECTED_RENDER_MS))
    : 2 + (t / EXPECTED_RENDER_MS) * 88;
  const secs = Math.floor(t / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 border-[3px] border-dashed border-[#131118] px-5 text-center">
      <div className="font-mono-brand text-[13px] font-bold tracking-[0.08em]">
        {over ? "STILL RENDERING" : "RENDERING"} ✱ {clock}
      </div>
      <div className="h-5 w-full max-w-[320px] border-[3px] border-[#131118] bg-[#F1EEE3] p-[2px]">
        <div
          className="render-stripes h-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <div className="font-mono-brand text-[11px] font-bold leading-[1.4] text-[#131118]/55">
        {over ? "LONGER THAN USUAL — IT'S STILL GOING" : "USUALLY ABOUT THREE MINUTES"}
      </div>
    </div>
  );
}

function StepHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-7">
      <div className="font-mono-brand text-[13px] font-bold tracking-[0.1em] text-[#6E2CF4]">STEP {n}</div>
      <h2 className="font-display m-0 mt-1 leading-[0.95]" style={{ fontSize: "clamp(32px, 4.5vw, 56px)" }}>
        {title}
      </h2>
      {sub && <p className="m-0 mt-3 max-w-[720px] text-[17px] font-medium leading-[1.5]">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function CreateFilmPage() {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [quality, setQuality] = useState<Quality>("hd");
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [ready, setReady] = useState<Ready[]>([]);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reelUrl, setReelUrl] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [needCredits, setNeedCredits] = useState<{ required: number; available: number } | null>(null);
  const { user } = useAuth();
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  /** Which shot currently has its reshoot note box open, and what's in it. */
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [now, setNow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[] | null>(null);
  shotsRef.current = shots;

  // One clock for the whole page rather than one per shot: the shots all render
  // in parallel, so they all want the same second.
  const anyRendering = !!shots?.some((s) => s.state === "generating");
  useEffect(() => {
    if (!anyRendering) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRendering]);

  useEffect(() => {
    if (DEMO) { setBalance(1000); return; }
    if (!user) return;
    getUserCredits(user.id).then((r) =>
      setBalance(r.success && r.credits ? r.credits.spendable : 0)
    );
  }, [user]);

  const softPhotos = photos.filter((p) => !p.hdCapable);
  const canDoHd = photos.length > 0 && softPhotos.length === 0;
  // One rule for what a set of photos costs, so the quote on the button and
  // the quote on the "build the ones that worked" offer can never disagree —
  // including the quality, which is a property of the set and moves when a
  // photo drops out of it.
  const qualityFor = useCallback(
    (list: { hdCapable: boolean }[]): Quality =>
      list.length > 0 && list.every((p) => p.hdCapable) ? quality : "sd",
    [quality]
  );
  const quoteFor = useCallback(
    (list: { withPeople: boolean; hdCapable: boolean }[]) =>
      quoteFilm(list.length, qualityFor(list), list.filter((p) => p.withPeople).length),
    [qualityFor]
  );

  const quote = useMemo(() => quoteFor(photos), [quoteFor, photos]);
  const readyQuote = useMemo(() => quoteFor(ready), [quoteFor, ready]);

  /* ---- step 1: intake ---------------------------------------------- */

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const tooSmall: { name: string; why: string }[] = [];
    const next: Photo[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = url;
      });
      const shortEdge = Math.min(dims.w, dims.h);
      // A photo this browser can't decode and one that's genuinely too small
      // are different problems with different answers, so they don't share a
      // message. HEIC straight off a Mac lands here, and "too small" would
      // send you looking at the wrong thing.
      if (!dims.w || !dims.h) {
        tooSmall.push({ name: file.name, why: "this browser could not read it — try a JPEG" });
        URL.revokeObjectURL(url);
        continue;
      }
      if (shortEdge < MIN_EDGE) {
        tooSmall.push({ name: file.name, why: `${dims.w}×${dims.h} — under ${MIN_EDGE}px, too small for any reel` });
        URL.revokeObjectURL(url);
        continue;
      }
      next.push({
        id: `${file.name}:${file.size}`,
        file,
        url,
        width: dims.w,
        height: dims.h,
        hdCapable: shortEdge >= HD_MIN_EDGE,
        withPeople: false,
      });
    }

    setRejected(tooSmall);
    setPhotos((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...next.filter((p) => !seen.has(p.id))];
    });
  }, []);

  // If anything in the set is too small for 1080p, hold the whole reel to
  // Standard. Mixing them would put visibly soft shots in an HD reel, and the
  // agent would only find out after paying for it.
  const effectiveQuality: Quality = canDoHd ? quality : "sd";

  /* ---- step 4: submit ---------------------------------------------- */

  async function generate() {
    setBusy(true);
    setError(null);
    setFailures([]);

    if (DEMO) {
      // Local walk-through with no KIE spend: show the shape of the result.
      setShots(
        photos.map((p, i) => ({
          position: i,
          sourceUrl: p.url,
          creditsHeld: 0,
          state: "success" as const,
          resultUrl: undefined,
          approved: false,
          ignored: false,
          withPeople: p.withPeople,
          startedAt: Date.now(),
        }))
      );
      setStep(5);
      setBusy(false);
      return;
    }

    try {
      // Photos have to be hosted before KIE can read them. Four at a time:
      // twenty sequential round trips is a long wait staring at a spinner, and
      // twenty at once is a good way to get rate limited.
      //
      // One photo failing no longer takes the other eleven with it. It used to
      // throw out of the lane, which threw out of the whole run, so a single
      // oversized file meant nothing built and no way to tell which file it
      // was. Every photo now gets its own verdict and the run continues.
      const uploaded: (Ready | null)[] = new Array(photos.length).fill(null);
      const failed: UploadFailure[] = [];
      const LANES = 4;
      let cursor = 0;
      const lane = async () => {
        while (cursor < photos.length) {
          const i = cursor++;
          const ph = photos[i];
          try {
            // Shrink before sending. Vercel drops anything over 4.5MB at the
            // edge, and a phone photo is routinely bigger than that.
            const prepped = await prepareForUpload(ph.file, ph.width, ph.height);
            const fd = new FormData();
            fd.append("file", prepped.file);
            const r = await fetch("/api/kie/upload", { method: "POST", body: fd });

            // Read the body as text and parse it by hand. A platform-level
            // rejection isn't JSON, and res.json() would throw about parsing
            // and bury the status that actually explains it.
            const raw = await r.text();
            let j: { url?: string; error?: string } = {};
            try {
              j = JSON.parse(raw);
            } catch {
              /* not ours — describeUploadFailure has to speak for it */
            }
            if (!r.ok || !j.url) {
              throw new Error(j.error || describeUploadFailure(r.status, prepped.file.size));
            }
            uploaded[i] = { url: j.url, withPeople: ph.withPeople, hdCapable: ph.hdCapable };
          } catch (e) {
            failed.push({
              name: ph.file.name,
              reason: e instanceof Error ? e.message : "upload failed",
            });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(LANES, photos.length) }, lane));

      const good = uploaded.filter((u): u is Ready => u !== null);
      setReady(good);

      // Stop and hand him the choice rather than quietly building a shorter
      // reel than the one he priced. Nothing is charged until startShots runs.
      if (failed.length > 0) {
        setFailures(failed);
        return;
      }

      await startShots(good);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  /** Hand the hosted photos to KIE and move to the approve screen. */
  async function startShots(good: Ready[]) {
    if (good.length === 0) return;
    setBusy(true);
    setError(null);
    const shotQuote = quoteFor(good);
    const shotQuality = qualityFor(good);

    try {
      const res = await fetch("/api/generate-video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: good.map((g) => ({ url: g.url, withPeople: g.withPeople })),
          quality: shotQuality,
        }),
      });
      const json = await res.json();
      if (res.status === 402) {
        // Out of credits is the one failure with an obvious next action, so
        // it gets its own panel and a way to fix it rather than a red banner.
        setNeedCredits({
          required: json.required ?? shotQuote.credits,
          available: json.available ?? 0,
        });
        return;
      }
      if (!json.ok) throw new Error(json.error || "Could not start the reel");

      setFailures([]);
      const initial: Shot[] = json.shots.map(
        (s: {
          position: number; sourceUrl: string; state: string;
          failMsg?: string; taskId?: string; creditsHeld?: number;
          move?: "push" | "locked"; pan?: "lr" | "rl" | null; withPeople?: boolean;
        }) => ({
          position: s.position,
          sourceUrl: s.sourceUrl,
          taskId: s.taskId,
          creditsHeld: s.creditsHeld ?? 0,
          settled: s.state === "fail",
          state: s.state === "fail" ? "fail" : "generating",
          failMsg: s.failMsg,
          approved: false,
          ignored: false,
          move: s.move,
          pan: s.pan ?? null,
          withPeople: Boolean(s.withPeople),
          startedAt: Date.now(),
        })
      );
      setShots(initial);
      setStep(5);
      void poll(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Poll until every shot is finished.
   *
   * `settled` is round-tripped so the server only ever charges or refunds a
   * shot once — without it, every poll after a shot lands would settle it
   * again. Shots that never reached KIE arrive already settled and are never
   * polled, because they have no task to ask about.
   */
  async function poll(current: Shot[]) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const live = shotsRef.current ?? current;
      const pending = live.filter((s) => s.taskId && s.state === "generating");
      if (pending.length === 0) return;

      await new Promise((r) => setTimeout(r, 5000));

      try {
        const res = await fetch("/api/generate-video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shots: (shotsRef.current ?? current)
              .filter((s) => s.taskId)
              .map((s) => ({ taskId: s.taskId, creditsHeld: s.creditsHeld, settled: s.settled })),
          }),
        });
        const json = await res.json();
        if (!json.ok) continue;

        const byTask = new Map<string, { state: string; url?: string; failMsg?: string; settled?: boolean }>(
          json.shots.map((s: { taskId: string; state: string; url?: string; failMsg?: string; settled?: boolean }) => [
            s.taskId,
            s,
          ])
        );
        setShots((prev) =>
          prev
            ? prev.map((s) => {
                const u = s.taskId ? byTask.get(s.taskId) : undefined;
                if (!u) return s;
                return {
                  ...s,
                  state: u.state === "success" ? "success" : u.state === "fail" ? "fail" : "generating",
                  resultUrl: u.url ?? s.resultUrl,
                  failMsg: u.failMsg ?? s.failMsg,
                  settled: u.settled ?? s.settled,
                  // A shot that came back is approved-by-default; the agent
                  // unticks the ones that don't match their photo.
                  approved: u.state === "success" ? s.approved : false,
                };
              })
            : prev
        );
        if (json.done) return;
      } catch {
        /* transient — the next sweep tries again */
      }
    }
  }

  /**
   * Reshoot one shot. A new generation, so it costs again — and says so.
   *
   * `note` is the agent's own words about what went wrong, and rides into the
   * prompt ahead of the accuracy rules so it can correct a shot without ever
   * licensing the model to add something the photo doesn't have.
   *
   * The move, the pan and the people all come from the shot being replaced.
   * This used to send `withPeople: false` and no move at all, so reshooting a
   * kitchen with a family in it returned an empty kitchen, and every reshoot
   * silently became shot one's push.
   */
  async function reshoot(index: number, note = "") {
    const shot = shots?.[index];
    if (!shot || DEMO) return;
    setError(null);
    setNoteFor(null);
    try {
      const res = await fetch("/api/generate-video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: [
            {
              url: shot.sourceUrl,
              withPeople: shot.withPeople,
              move: shot.move ?? "locked",
              pan: shot.pan ?? null,
              note,
            },
          ],
          quality: effectiveQuality,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Could not reshoot");
      const fresh = json.shots[0];
      setShots((prev) =>
        prev
          ? prev.map((s, i) =>
              i === index
                ? {
                    ...s,
                    taskId: fresh.taskId,
                    creditsHeld: fresh.creditsHeld ?? 0,
                    settled: false,
                    state: "generating",
                    resultUrl: undefined,
                    failMsg: undefined,
                    approved: false,
                    ignored: false,
                    move: fresh.move ?? s.move,
                    pan: fresh.pan ?? s.pan ?? null,
                    startedAt: Date.now(),
                  }
                : s
            )
          : prev
      );
      void poll(shotsRef.current ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reshoot");
    }
  }

  /**
   * Hand the approved shots to the joiner and store what comes back.
   *
   * Anything that goes wrong is reported *beside the button*, not in the banner
   * at the top of the page. On a phone the approve screen is metres long, so a
   * message up there is a message nobody sees — which is exactly how a broken
   * route looked like a button that did nothing.
   */
  async function buildReel() {
    const approved = (shots ?? []).filter((s) => s.approved && !s.ignored && s.resultUrl);
    if (approved.length === 0) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch("/api/reel/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shots: approved.map((s) => s.resultUrl),
          // Positional, so it has to be built from the same filtered list.
          pans: approved.map((s) => s.pan ?? null),
        }),
      });
      // Read as text first. A 404 or a gateway timeout answers with HTML, and
      // res.json() on that throws a parse error that says nothing useful.
      const raw = await res.text();
      let json: { ok?: boolean; url?: string; error?: string } = {};
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`The reel builder answered ${res.status} and not with a reel.`);
      }
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error || `The reel builder answered ${res.status}.`);
      }
      setReelUrl(json.url);
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Could not build the reel");
    } finally {
      setBuilding(false);
    }
  }

  /* ------------------------------------------------------------- render */

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      {/* progress */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono-brand text-[13px] font-bold tracking-[0.1em] text-[#131118]/60">
          NEW REEL
        </div>
        <Link
          href="/app/subscription"
          className={`font-mono-brand border-[3px] border-[#131118] px-4 py-2 text-[13px] font-bold transition-colors ${
            balance === 0 ? "bg-[#6E2CF4] text-[#F1EEE3]" : "bg-[#D8FF3E]"
          }`}
        >
          {balance === null ? "BALANCE …" : `${balance.toLocaleString()} CREDITS`}
          {balance === 0 ? " — BUY SOME" : ""}
        </Link>
      </div>
      <div className="mb-10 flex flex-wrap gap-2.5">
        {["Photos", "Quality", "People", "Generate", "Approve"].map((label, i) => {
          const n = i + 1;
          const on = step === n;
          const done = step > n;
          return (
            <div
              key={label}
              className={`font-mono-brand border-[3px] border-[#131118] px-4 py-2 text-[13px] font-bold uppercase tracking-[0.06em] ${
                on ? "bg-[#D8FF3E]" : done ? "bg-[#131118] text-[#F1EEE3]" : "bg-transparent text-[#131118]/45"
              }`}
            >
              {n}. {label}
            </div>
          );
        })}
      </div>

      {needCredits && (
        <div className="mb-7 border-[3px] border-[#131118] bg-[#D8FF3E] px-6 py-6 shadow-[8px_8px_0_#131118]">
          <div className="font-display text-[30px] leading-none">
            {needCredits.available === 0 ? "You have no credits yet." : "Not enough credits."}
          </div>
          <p className="m-0 mt-3 max-w-[640px] text-[16px] font-medium leading-[1.5]">
            This reel needs <strong>{needCredits.required.toLocaleString()} credits</strong> and you have{" "}
            <strong>{needCredits.available.toLocaleString()}</strong>. Nothing was generated and nothing was
            charged — your photos are still here, so you can pick up exactly where you left off.
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/app/subscription"
              className="inline-block border-[3px] border-[#131118] bg-[#131118] px-7 py-3.5 text-[15px] font-extrabold uppercase text-[#F1EEE3] transition-colors hover:bg-[#6E2CF4]"
            >
              Get credits
            </Link>
            <button
              type="button"
              onClick={() => setNeedCredits(null)}
              className="inline-block border-[3px] border-[#131118] px-7 py-3.5 text-[15px] font-extrabold uppercase transition-colors hover:bg-[#131118] hover:text-[#F1EEE3]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-7 border-[3px] border-[#131118] bg-[#6E2CF4] px-5 py-4 text-[16px] font-bold text-[#F1EEE3]">
          {error}
        </div>
      )}

      {/* ---------------------------------------------------- 1. photos */}
      {step === 1 && (
        <Panel>
          <StepHead
            n="01"
            title="Upload the photos"
            sub="The ones from the listing you already have. One photo becomes one shot, so the number you drop in is the length of the reel. Nothing gets scraped and nothing gets added."
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer border-[3px] border-dashed border-[#131118] bg-[#F1EEE3] px-6 py-16 text-center transition-colors hover:bg-[#D8FF3E]/40"
          >
            <div className="font-display text-[34px] leading-none">DROP THE FOLDER HERE</div>
            <div className="font-mono-brand mt-3 text-[13px] font-bold tracking-[0.08em] text-[#131118]/60">
              OR CLICK TO CHOOSE ✱ MINIMUM {MIN_EDGE}px ON THE SHORT EDGE
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void addFiles(e.target.files)}
            />
          </div>

          {rejected.length > 0 && (
            <div className="mt-6 border-[3px] border-[#131118] bg-[#131118] px-5 py-4 text-[#F1EEE3]">
              <div className="font-mono-brand mb-2 text-[12px] font-bold tracking-[0.1em] text-[#D8FF3E]">
                SKIPPED — {rejected.length} PHOTO{rejected.length === 1 ? "" : "S"} NOT ADDED
              </div>
              {rejected.map((r) => (
                <div key={r.name} className="text-[14px]">
                  <strong>{r.name}</strong> — {r.why}
                </div>
              ))}
            </div>
          )}

          {softPhotos.length > 0 && (
            <div className="mt-6 border-[3px] border-[#131118] bg-[#D8FF3E] px-5 py-4">
              <div className="font-mono-brand mb-2 text-[12px] font-bold tracking-[0.1em]">
                THESE WILL BE STANDARD DEFINITION
              </div>
              <p className="m-0 mb-2 text-[15px] font-medium leading-[1.5]">
                {softPhotos.length} of your photo{softPhotos.length === 1 ? " is" : "s are"} under{" "}
                {HD_MIN_EDGE}px on the short edge. They&apos;ll make a good <strong>768p</strong> reel, but 1080p
                would have to stretch them and it shows. This reel is set to Standard.
              </p>
              {softPhotos.map((p) => (
                <div key={p.id} className="font-mono-brand text-[13px]">
                  {p.file.name} — {p.width}×{p.height}
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
                {photos.map((p, i) => (
                  <div key={p.id} className="border-[3px] border-[#131118]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="font-mono-brand flex items-center justify-between border-t-[3px] border-[#131118] px-2 py-1 text-[11px] font-bold">
                      <span>SHOT {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-[#6E2CF4] hover:underline"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between gap-6">
                <div className="font-display text-[26px]">
                  {photos.length} PHOTO{photos.length === 1 ? "" : "S"} = {photos.length} SHOT
                  {photos.length === 1 ? "" : "S"}
                </div>
                <Btn onClick={() => setStep(2)}>Next</Btn>
              </div>
            </>
          )}
        </Panel>
      )}

      {/* --------------------------------------------------- 2. quality */}
      {step === 2 && (
        <Panel>
          <StepHead n="02" title="Standard or High Definition" sub="Both are built the same way from the same photographs. High Definition is sharper on a big screen and costs more credits." />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {(["sd", "hd"] as Quality[]).map((q) => {
              const blocked = q === "hd" && !canDoHd;
              const on = effectiveQuality === q;
              return (
                <button
                  key={q}
                  type="button"
                  disabled={blocked}
                  onClick={() => !blocked && setQuality(q)}
                  className={`border-[3px] border-[#131118] px-7 py-8 text-left transition-colors ${
                    blocked
                      ? "cursor-not-allowed bg-[#F1EEE3] opacity-45"
                      : on
                        ? "bg-[#D8FF3E] shadow-[8px_8px_0_#131118]"
                        : "bg-[#F1EEE3] hover:bg-[#D8FF3E]/40"
                  }`}
                >
                  <div className="font-mono-brand text-[13px] font-bold tracking-[0.1em]">
                    {q === "hd" ? "HIGH DEFINITION" : "STANDARD"}
                  </div>
                  <div className="font-display mt-1 text-[52px] leading-none">
                    {RATES.shot[q]}
                    <span className="text-[20px]"> CR / SHOT</span>
                  </div>
                  <div className="mt-3 text-[16px] font-medium">
                    {q === "hd" ? "1080p — for the portal and the big screen." : "768p — fine on a phone, lighter on credits."}
                  </div>
                  <div className="font-mono-brand mt-4 text-[13px] font-bold text-[#131118]/60">
                    {blocked
                      ? `NEEDS PHOTOS ${HD_MIN_EDGE}px OR LARGER`
                      : `THIS REEL: ${photos.length * RATES.shot[q]} CREDITS`}
                  </div>
                </button>
              );
            })}
          </div>
          {!canDoHd && photos.length > 0 && (
            <p className="m-0 mt-5 text-[15px] font-medium leading-[1.5]">
              High Definition is unavailable because {softPhotos.length} of your photo
              {softPhotos.length === 1 ? " is" : "s are"} under {HD_MIN_EDGE}px on the short edge.
              Standard makes a good reel from them; 1080p would just stretch them.
            </p>
          )}
          <div className="mt-8 flex justify-between">
            <Btn tone="ghost" onClick={() => setStep(1)}>Back</Btn>
            <Btn onClick={() => setStep(3)}>Next</Btn>
          </div>
        </Panel>
      )}

      {/* ---------------------------------------------------- 3. people */}
      {step === 3 && (
        <Panel>
          <StepHead
            n="03"
            title="Anyone home?"
            sub="An empty house photographs well and sells slowly. You can put a family into the rooms people actually live in — but only into those rooms, and the room itself never changes."
          />
          <div className="mb-7 border-[3px] border-[#131118] bg-[#131118] px-5 py-4 text-[#F1EEE3]">
            <div className="font-mono-brand mb-2 text-[12px] font-bold tracking-[0.1em] text-[#D8FF3E]">THE RULES, AND THEY AREN&apos;T OPTIONAL</div>
            <div className="text-[15px] leading-[1.6]">
              People go where they&apos;re <strong>doing something</strong> — eating, cooking. Exteriors stay empty.
              Bathrooms, laundries, robes and pantries are never offered. One family per property. No pets.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <div key={p.id} className="border-[3px] border-[#131118]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="border-t-[3px] border-[#131118] p-3">
                  <div className="font-mono-brand mb-2 text-[11px] font-bold">SHOT {i + 1}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PEOPLE_ROOMS.map((room) => {
                      const on = p.room === room && p.withPeople;
                      return (
                        <button
                          key={room}
                          type="button"
                          onClick={() =>
                            setPhotos((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? on
                                    ? { ...x, withPeople: false, room: undefined }
                                    : { ...x, withPeople: true, room }
                                  : x
                              )
                            )
                          }
                          className={`border-2 border-[#131118] px-2 py-1 text-[12px] font-bold uppercase transition-colors ${
                            on ? "bg-[#6E2CF4] text-[#F1EEE3]" : "bg-transparent hover:bg-[#D8FF3E]"
                          }`}
                        >
                          {room}
                        </button>
                      );
                    })}
                  </div>
                  <div className="font-mono-brand mt-2 text-[11px] font-bold text-[#131118]/50">
                    {p.withPeople ? `+${RATES.familyRoom} CREDITS` : "NO PEOPLE — LEAVE AS SHOT"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <Btn tone="ghost" onClick={() => setStep(2)}>Back</Btn>
            <Btn onClick={() => setStep(4)}>Next</Btn>
          </div>
        </Panel>
      )}

      {/* -------------------------------------------------- 4. generate */}
      {step === 4 && (
        <Panel>
          <StepHead n="04" title="Ready to build" sub="Nothing is charged until you press the button, and a shot that fails costs you nothing." />
          <div className="border-[3px] border-[#131118] bg-[#131118] p-7 text-[#F1EEE3]">
            <div className="flex flex-wrap justify-between gap-4 border-b border-[#F1EEE3]/20 py-2 text-[17px]">
              <span>{quote.shots} shots — {effectiveQuality === "hd" ? "High Definition" : "Standard"}</span>
              <span className="font-bold">{quote.shots * RATES.shot[effectiveQuality]} cr</span>
            </div>
            {quote.familyRooms > 0 && (
              <div className="flex flex-wrap justify-between gap-4 border-b border-[#F1EEE3]/20 py-2 text-[17px]">
                <span>{quote.familyRooms} room{quote.familyRooms === 1 ? "" : "s"} with a family</span>
                <span className="font-bold">{quote.familyRooms * RATES.familyRoom} cr</span>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <span className="font-mono-brand text-[13px] font-bold tracking-[0.1em] text-[#D8FF3E]">TOTAL</span>
              <span className="font-display text-[58px] leading-none">{quote.credits} CR</span>
            </div>
          </div>
          <div className="mt-8 flex justify-between">
            <Btn tone="ghost" onClick={() => setStep(3)}>Back</Btn>
            <Btn
              tone="lime"
              onClick={() => void generate()}
              disabled={busy || quote.shots === 0 || (balance !== null && balance < quote.credits)}
            >
              {busy
                ? "Starting…"
                : balance !== null && balance < quote.credits
                  ? `Need ${(quote.credits - balance).toLocaleString()} more credits`
                  : `Generate ${quote.shots} shots`}
            </Btn>
          </div>

          {/*
            Directly under the button, which is where the finger already is.
            An upload failure used to set the banner at the top of the page —
            metres away on a phone — and killed the whole batch with it.
          */}
          {failures.length > 0 && (
            <div className="mt-6 border-[3px] border-[#131118] bg-[#131118] px-5 py-4 text-[#F1EEE3]">
              <div className="font-mono-brand mb-3 text-[12px] font-bold tracking-[0.1em] text-[#D8FF3E]">
                {failures.length} PHOTO{failures.length === 1 ? "" : "S"} DIDN&apos;T UPLOAD
              </div>
              {failures.map((f) => (
                <div key={f.name} className="mb-1 text-[15px] leading-[1.45]">
                  <strong>{f.name}</strong> — {f.reason}
                </div>
              ))}

              {ready.length > 0 ? (
                <>
                  <p className="m-0 mt-4 text-[15px] font-medium leading-[1.5]">
                    The other {ready.length} uploaded fine and {ready.length === 1 ? "is" : "are"} ready
                    to go. <strong>Nothing has been charged.</strong> Build those now, or go back and
                    swap the {failures.length === 1 ? "one" : "ones"} above.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Btn
                      tone="lime"
                      onClick={() => void startShots(ready)}
                      disabled={busy || (balance !== null && balance < readyQuote.credits)}
                    >
                      {busy
                        ? "Starting…"
                        : balance !== null && balance < readyQuote.credits
                          ? `Need ${(readyQuote.credits - balance).toLocaleString()} more credits`
                          : `Build ${readyQuote.shots} shots — ${readyQuote.credits} cr`}
                    </Btn>
                    <Btn tone="ghost" onClick={() => { setFailures([]); setStep(1); }}>
                      Back to photos
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <p className="m-0 mt-4 text-[15px] font-medium leading-[1.5]">
                    None of them uploaded, so there is nothing to build.{" "}
                    <strong>Nothing has been charged.</strong>
                  </p>
                  <div className="mt-5">
                    <Btn tone="ghost" onClick={() => { setFailures([]); setStep(1); }}>
                      Back to photos
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>
      )}

      {/* --------------------------------------------------- 5. approve */}
      {step === 5 && shots && (
        <Panel>
          <StepHead
            n="05"
            title="Check every shot"
            sub="Each shot sits beside the photograph it came from. If a wall moved, a window changed shape or a room grew, ignore it or shoot it again — only what you approve goes in the reel."
          />
          <div className="flex flex-col gap-6">
            {shots.map((s, i) => (
              <div
                key={s.position}
                className={`border-[3px] border-[#131118] p-4 ${s.ignored ? "opacity-45" : ""}`}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_190px]">
                  <div>
                    <div className="font-mono-brand mb-2 inline-block bg-[#131118] px-2 py-1 text-[11px] font-bold text-[#F1EEE3]">
                      THE PHOTO
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.sourceUrl} alt="" className="aspect-video w-full border-[3px] border-[#131118] object-cover" />
                  </div>
                  <div>
                    <div className="font-mono-brand mb-2 inline-block bg-[#6E2CF4] px-2 py-1 text-[11px] font-bold text-[#F1EEE3]">
                      SHOT {i + 1}
                    </div>
                    {s.state === "success" && s.resultUrl ? (
                      <video src={s.resultUrl} className="aspect-video w-full border-[3px] border-[#131118] object-cover" controls muted loop playsInline />
                    ) : s.state === "generating" && !DEMO ? (
                      <RenderProgress elapsedMs={now - s.startedAt} />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center border-[3px] border-dashed border-[#131118] text-center">
                        <span className="font-mono-brand text-[13px] font-bold">
                          {s.state === "fail" ? s.failMsg || "FAILED — NOT CHARGED" : "DEMO — NOT RENDERED"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <button
                      type="button"
                      disabled={s.state !== "success" || s.ignored}
                      onClick={() =>
                        setShots((prev) => prev!.map((x, n) => (n === i ? { ...x, approved: !x.approved } : x)))
                      }
                      className={`border-[3px] border-[#131118] px-4 py-3 text-[15px] font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        s.approved ? "bg-[#D8FF3E]" : "bg-transparent hover:bg-[#D8FF3E]/40"
                      }`}
                    >
                      {s.approved ? "✓ Approved" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNoteText("");
                        setNoteFor(noteFor === i ? null : i);
                      }}
                      disabled={s.state === "generating" || s.ignored}
                      className="border-[3px] border-[#131118] bg-transparent px-4 py-3 text-[15px] font-extrabold uppercase transition-colors hover:bg-[#6E2CF4] hover:text-[#F1EEE3] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reshoot
                    </button>
                    {/* Ignore is not the same as leaving a shot unapproved. It
                        says "I looked at this and it's out", which is what makes
                        the counter below mean anything. */}
                    <button
                      type="button"
                      onClick={() => {
                        setNoteFor((n) => (n === i ? null : n));
                        setShots((prev) =>
                          prev!.map((x, n) =>
                            n === i ? { ...x, ignored: !x.ignored, approved: false } : x
                          )
                        );
                      }}
                      className="border-[3px] border-[#131118] bg-transparent px-4 py-2.5 text-[13px] font-extrabold uppercase transition-colors hover:bg-[#131118] hover:text-[#F1EEE3]"
                    >
                      {s.ignored ? "Put it back" : "Ignore"}
                    </button>
                    <span className="font-mono-brand text-center text-[11px] font-bold text-[#131118]/50">
                      {s.ignored ? "NOT IN THE REEL" : `RESHOOT COSTS ${RATES.shot[effectiveQuality]} CR`}
                    </span>
                  </div>
                </div>

                {noteFor === i && (
                  <div className="mt-4 border-[3px] border-[#131118] bg-[#131118] p-4 text-[#F1EEE3]">
                    <label
                      htmlFor={`note-${i}`}
                      className="font-mono-brand mb-2 block text-[12px] font-bold tracking-[0.08em] text-[#D8FF3E]"
                    >
                      WHAT WENT WRONG, AND WHAT YOU WANT INSTEAD
                    </label>
                    <textarea
                      id={`note-${i}`}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value.slice(0, MAX_NOTE))}
                      rows={3}
                      autoFocus
                      placeholder="e.g. it added a second doorway on the left — hold tighter on the bench and don't drift"
                      className="w-full border-[3px] border-[#F1EEE3] bg-[#131118] p-3 text-[15px] text-[#F1EEE3] placeholder:text-[#F1EEE3]/40 focus:outline-none focus:border-[#D8FF3E]"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono-brand text-[11px] font-bold text-[#F1EEE3]/50">
                        {noteText.length}/{MAX_NOTE} ✱ NOTHING YOU TYPE CAN ADD SOMETHING THE PHOTO DOESN&apos;T HAVE
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setNoteFor(null)}
                          className="border-[3px] border-[#F1EEE3] px-5 py-2.5 text-[14px] font-extrabold uppercase transition-colors hover:bg-[#F1EEE3] hover:text-[#131118]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void reshoot(i, noteText)}
                          className="border-[3px] border-[#D8FF3E] bg-[#D8FF3E] px-5 py-2.5 text-[14px] font-extrabold uppercase text-[#131118] transition-colors hover:bg-[#6E2CF4] hover:border-[#6E2CF4] hover:text-[#F1EEE3]"
                        >
                          Reshoot — {RATES.shot[effectiveQuality]} CR
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="font-display text-[26px]">
              {shots.filter((s) => s.approved && !s.ignored).length} OF {shots.length} APPROVED
              {shots.some((s) => s.ignored) && (
                <span className="font-mono-brand ml-4 text-[13px] font-bold text-[#131118]/55">
                  {shots.filter((s) => s.ignored).length} IGNORED
                </span>
              )}
              {shots.some((s) => !s.ignored && s.state === "generating") && (
                <span className="font-mono-brand ml-4 text-[13px] font-bold text-[#6E2CF4]">
                  {shots.filter((s) => !s.ignored && s.state === "generating").length} STILL RENDERING…
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Btn
                tone="lime"
                onClick={() => void buildReel()}
                disabled={
                  building ||
                  shots.filter((s) => s.approved && !s.ignored && s.resultUrl).length === 0 ||
                  // An ignored shot isn't going in the reel, so waiting for it
                  // to finish rendering would be waiting for nothing.
                  shots.some((s) => !s.ignored && s.state === "generating")
                }
              >
                {building ? "Building…" : "Build the reel"}
              </Btn>
              {building && (
                <span className="font-mono-brand text-[11px] font-bold text-[#131118]/55">
                  JOINING THE SHOTS ✱ UP TO A MINUTE
                </span>
              )}
            </div>
          </div>

          {buildError && (
            <div className="mt-5 border-[3px] border-[#131118] bg-[#6E2CF4] px-5 py-4 text-[16px] font-bold text-[#F1EEE3]">
              {buildError}
            </div>
          )}

          {reelUrl && (
            <div className="mt-8 border-[3px] border-[#131118] bg-[#131118] p-6 text-[#F1EEE3]">
              <div className="font-mono-brand mb-3 text-[12px] font-bold tracking-[0.1em] text-[#D8FF3E]">
                YOUR REEL
              </div>
              <video src={reelUrl} controls playsInline className="w-full border-[3px] border-[#F1EEE3]" />
              <div className="mt-4 flex flex-wrap gap-4">
                <a
                  href={reelUrl}
                  download
                  className="inline-block border-[3px] border-[#D8FF3E] bg-[#D8FF3E] px-6 py-3 text-[15px] font-extrabold uppercase text-[#131118] transition-colors hover:bg-[#F1EEE3] hover:border-[#F1EEE3]"
                >
                  Download
                </a>
                <a
                  href={reelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block border-[3px] border-[#F1EEE3] px-6 py-3 text-[15px] font-extrabold uppercase transition-colors hover:bg-[#F1EEE3] hover:text-[#131118]"
                >
                  Open
                </a>
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
