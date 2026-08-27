"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { RATES, quoteFilm, type Quality } from "@/lib/pricing";

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

const MIN_EDGE = 1000;

type Photo = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  room?: PeopleRoom;
  withPeople: boolean;
};

type Shot = {
  position: number;
  sourceUrl: string;
  state: "generating" | "success" | "fail";
  resultUrl?: string;
  failMsg?: string;
  approved: boolean;
};

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
  const [rejected, setRejected] = useState<string[]>([]);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const familyRooms = photos.filter((p) => p.withPeople).length;
  const quote = useMemo(
    () => quoteFilm(photos.length, quality, familyRooms),
    [photos.length, quality, familyRooms]
  );

  /* ---- step 1: intake ---------------------------------------------- */

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const tooSmall: string[] = [];
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
      // A small file makes a soft film. Better to say so than to render it.
      if (Math.min(dims.w, dims.h) < MIN_EDGE) {
        tooSmall.push(`${file.name} — ${dims.w}×${dims.h}`);
        URL.revokeObjectURL(url);
        continue;
      }
      next.push({
        id: `${file.name}:${file.size}`,
        file,
        url,
        width: dims.w,
        height: dims.h,
        withPeople: false,
      });
    }

    setRejected(tooSmall);
    setPhotos((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...next.filter((p) => !seen.has(p.id))];
    });
  }, []);

  /* ---- step 4: submit ---------------------------------------------- */

  async function generate() {
    setBusy(true);
    setError(null);

    if (DEMO) {
      // Local walk-through with no KIE spend: show the shape of the result.
      setShots(
        photos.map((p, i) => ({
          position: i,
          sourceUrl: p.url,
          state: "success" as const,
          resultUrl: undefined,
          approved: false,
        }))
      );
      setStep(5);
      setBusy(false);
      return;
    }

    try {
      // Photos have to be hosted before KIE can read them.
      const uploaded: { url: string; withPeople: boolean }[] = [];
      for (const p of photos) {
        const fd = new FormData();
        fd.append("file", p.file);
        const r = await fetch("/api/kie/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!j?.url) throw new Error(`Could not upload ${p.file.name}`);
        uploaded.push({ url: j.url, withPeople: p.withPeople });
      }

      const res = await fetch("/api/generate-video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: uploaded, quality }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Could not start the film");

      setShots(
        json.shots.map((s: { position: number; sourceUrl: string; state: string; failMsg?: string }) => ({
          position: s.position,
          sourceUrl: s.sourceUrl,
          state: s.state === "fail" ? "fail" : "generating",
          failMsg: s.failMsg,
          approved: false,
        }))
      );
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------- render */

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      {/* progress */}
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
            sub="The ones from the listing you already have. One photo becomes one shot, so the number you drop in is the length of the film. Nothing gets scraped and nothing gets added."
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
                SKIPPED — TOO SMALL TO HOLD UP AT FULL SIZE
              </div>
              {rejected.map((r) => (
                <div key={r} className="text-[14px]">{r}</div>
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
              const on = quality === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`border-[3px] border-[#131118] px-7 py-8 text-left transition-colors ${
                    on ? "bg-[#D8FF3E] shadow-[8px_8px_0_#131118]" : "bg-[#F1EEE3] hover:bg-[#D8FF3E]/40"
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
                    THIS FILM: {photos.length * RATES.shot[q]} CREDITS
                  </div>
                </button>
              );
            })}
          </div>
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
              <span>{quote.shots} shots — {quality === "hd" ? "High Definition" : "Standard"}</span>
              <span className="font-bold">{quote.shots * RATES.shot[quality]} cr</span>
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
            <Btn tone="lime" onClick={() => void generate()} disabled={busy || quote.shots === 0}>
              {busy ? "Starting…" : `Generate ${quote.shots} shots`}
            </Btn>
          </div>
        </Panel>
      )}

      {/* --------------------------------------------------- 5. approve */}
      {step === 5 && shots && (
        <Panel>
          <StepHead
            n="05"
            title="Check every shot"
            sub="Each shot sits beside the photograph it came from. If a wall moved, a window changed shape or a room grew, reject it and shoot it again — only what you approve goes in the film."
          />
          <div className="flex flex-col gap-6">
            {shots.map((s, i) => (
              <div key={s.position} className="grid grid-cols-1 gap-4 border-[3px] border-[#131118] p-4 md:grid-cols-[1fr_1fr_190px]">
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
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center border-[3px] border-dashed border-[#131118] text-center">
                      <span className="font-mono-brand text-[13px] font-bold">
                        {s.state === "fail" ? s.failMsg || "FAILED — NOT CHARGED" : DEMO ? "DEMO — NOT RENDERED" : "RENDERING…"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShots((prev) => prev!.map((x, n) => (n === i ? { ...x, approved: !x.approved } : x)))}
                    className={`border-[3px] border-[#131118] px-4 py-3 text-[15px] font-extrabold uppercase transition-colors ${
                      s.approved ? "bg-[#D8FF3E]" : "bg-transparent hover:bg-[#D8FF3E]/40"
                    }`}
                  >
                    {s.approved ? "✓ Approved" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="border-[3px] border-[#131118] bg-transparent px-4 py-3 text-[15px] font-extrabold uppercase transition-colors hover:bg-[#6E2CF4] hover:text-[#F1EEE3]"
                  >
                    Reshoot
                  </button>
                  <span className="font-mono-brand text-center text-[11px] font-bold text-[#131118]/50">
                    RESHOOT COSTS {RATES.shot[quality]} CR
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="font-display text-[26px]">
              {shots.filter((s) => s.approved).length} OF {shots.length} APPROVED
            </div>
            <Btn tone="lime" disabled={shots.filter((s) => s.approved).length === 0}>
              Build the film
            </Btn>
          </div>
        </Panel>
      )}
    </div>
  );
}
