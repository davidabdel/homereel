"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PLANS, RATES, TOPUPS } from "@/lib/pricing";

const ROTATING = ["MOVE", "SELL", "SCROLL-PROOF", "UNMISSABLE"];

function useRotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 2000);
    return () => clearInterval(t);
  }, []);
  return ROTATING[i];
}

function Stat({ target, suffix, decimals, label, text }: { target?: number; suffix?: string; decimals?: number; label: string; text?: string }) {
  const [val, setVal] = useState(target ?? 0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (text !== undefined) return;
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (still) return;                       // leave it on the true figure
    setVal(0);                               // safe to animate from zero now
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const dur = 1400;
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const p = 1 - Math.pow(1 - t, 3);
            setVal((target ?? 0) * p);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, text]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-display leading-none" style={{ fontSize: "clamp(56px, 9vw, 130px)" }}>
        {text !== undefined ? text : `${val.toFixed(decimals ?? 0)}${suffix ?? ""}`}
      </div>
      <div className="font-mono-brand mt-2.5 text-[13px] font-bold tracking-[0.1em] text-[#F1EEE3]/70">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const word = useRotatingWord();

  return (
    <div className="w-full bg-[#F1EEE3] text-[#131118]">
      {/* ============ NAV ============ */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-6 border-b-[3px] border-[#131118] bg-[#F1EEE3] px-[4vw] py-3.5">
        <Link href="#top" className="font-display flex items-baseline gap-0.5 text-[26px] tracking-[0.01em]">
          HOME<span className="text-[#6E2CF4]">✱</span>REEL
        </Link>
        <div className="hidden items-center gap-8 text-[15px] font-bold uppercase tracking-[0.04em] md:flex">
          <Link href="#showcase" className="hover:text-[#6E2CF4]">Showcase</Link>
          <Link href="#how" className="hover:text-[#6E2CF4]">How it works</Link>
          <Link href="#pricing" className="hover:text-[#6E2CF4]">Pricing</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-[15px] font-bold uppercase hover:text-[#6E2CF4]">Login</Link>
          <Link
            href="/register"
            className="inline-block border-[3px] border-[#131118] bg-[#D8FF3E] px-5 py-2.5 text-[15px] font-extrabold uppercase tracking-[0.03em] text-[#131118] shadow-[4px_4px_0_#131118] transition-colors hover:bg-[#6E2CF4] hover:text-[#F1EEE3]"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section
        id="top"
        className="relative flex min-h-[94vh] flex-col justify-end overflow-hidden border-b-[3px] border-[#131118] pt-[118px]"
      >
        <div
          className="font-display pointer-events-none absolute left-[-6%] top-[6%] whitespace-nowrap leading-none text-transparent"
          style={{
            fontSize: "26vw",
            WebkitTextStroke: "2px rgba(19,17,24,0.14)",
            animation: "drift 9s ease-in-out infinite alternate",
          }}
        >
          HOME✱
        </div>

        <div className="relative max-w-[1500px] px-[4vw]">
          {/* The whole proposition as a picture: their photos, then the reel
              those exact photos became. Both real — the stills are source
              frames from the Denham Court listing and the video is the reel
              built from them. In the flow, not absolutely positioned, so the
              headline always sits below it rather than colliding at some
              viewport heights. */}
          <div className="anim-rise mb-[46px] hidden items-start gap-6 lg:flex">
            <div className="relative h-[232px] w-[228px] shrink-0">
              {[
                { src: "/hero/photo3.jpg", rot: -9, x: 0, y: 26, z: 1 },
                { src: "/hero/photo2.jpg", rot: 5, x: 22, y: 13, z: 2 },
                { src: "/hero/photo1.jpg", rot: -2, x: 8, y: 0, z: 3 },
              ].map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={ph.src}
                  src={ph.src}
                  alt=""
                  className="absolute w-[200px] border-[3px] border-[#131118] bg-[#F1EEE3] object-cover shadow-[6px_6px_0_rgba(19,17,24,0.3)]"
                  style={{ transform: `rotate(${ph.rot}deg)`, left: ph.x, top: ph.y, zIndex: ph.z }}
                />
              ))}
              <div className="font-mono-brand absolute bottom-0 left-2 z-10 border-2 border-[#131118] bg-[#D8FF3E] px-2.5 py-[3px] text-[11px] font-bold">
                THEIR PHOTOS
              </div>
            </div>

            <svg width="66" height="34" viewBox="0 0 66 34" aria-hidden className="mt-[74px] shrink-0">
              <path d="M2 17h44M40 5l16 12-16 12" fill="none" stroke="#131118"
                    strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>

            <div className="relative shrink-0">
              <video
                src="/hero/culverston.mp4"
                poster="/hero/culverston.jpg"
                preload="metadata"
                autoPlay
                muted
                loop
                playsInline
                className="h-[232px] w-[412px] border-[3px] border-[#131118] object-cover shadow-[8px_8px_0_#131118]"
              />
              <div className="font-mono-brand absolute bottom-2.5 right-2.5 border-2 border-[#131118] bg-[#6E2CF4] px-2.5 py-[3px] text-[11px] font-bold text-[#F1EEE3]">
                ONE REEL
              </div>
            </div>
          </div>

          <div className="anim-rise font-mono-brand mb-[22px] flex items-center gap-3 text-[15px] font-bold tracking-[0.08em]">
            <span className="inline-block h-3 w-3 border-2 border-[#131118] bg-[#D8FF3E]" />
            THE LISTING PHOTOS YOU ALREADY HAVE — TURNED INTO A REEL
          </div>
          <h1 className="font-display anim-rise m-0 leading-[0.92]" style={{ fontSize: "clamp(64px, 12vw, 200px)" }}>
            <span className="block">MAKE LISTINGS</span>
            <span
              className="inline-block bg-[#D8FF3E] px-[0.12em] pb-[0.02em] shadow-[8px_8px_0_#131118]"
              style={{ transform: "rotate(-1.5deg)" }}
            >
              <span key={word} className="inline-block" style={{ animation: "popIn 0.45s cubic-bezier(0.2,0.9,0.3,1.2)" }}>
                {word}
              </span>
            </span>
          </h1>
          <div className="anim-rise my-[42px] mb-[60px] flex flex-wrap items-end gap-10">
            <p className="m-0 max-w-[560px] text-[21px] font-medium leading-[1.45]">
              Upload the photos from a listing you already have. Every photo becomes a moving shot, joined into
              one reel. No camera. No crew. No site visit. And nothing on screen that isn&apos;t in the house.
            </p>
            <div className="flex flex-wrap gap-[18px]">
              <Link
                href="/register"
                className="inline-block border-[3px] border-[#131118] bg-[#131118] px-[34px] py-[18px] text-[18px] font-extrabold uppercase tracking-[0.03em] text-[#F1EEE3] shadow-[6px_6px_0_rgba(19,17,24,0.25)] transition-colors hover:bg-[#6E2CF4]"
              >
                Make my first reel
              </Link>
              <Link
                href="#showcase"
                className="inline-block border-[3px] border-[#131118] bg-transparent px-[34px] py-[18px] text-[18px] font-extrabold uppercase tracking-[0.03em] text-[#131118] transition-colors hover:bg-[#D8FF3E]"
              >
                See one
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute right-[4vw] top-[300px] hidden flex-col items-end gap-[18px] xl:flex">
          <div
            className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full border-[3px] border-[#131118] bg-[#6E2CF4] text-center text-[#F1EEE3]"
            style={{ animation: "wobble 3.5s ease-in-out infinite alternate" }}
          >
            <span className="font-display text-[32px]">$19</span>
            <span className="font-mono-brand text-[11px] font-bold">A MONTH</span>
          </div>
          <div
            className="font-mono-brand border-[3px] border-[#131118] bg-[#F1EEE3] px-[18px] py-2.5 text-[13px] font-bold shadow-[5px_5px_0_#131118]"
            style={{ transform: "rotate(6deg)" }}
          >
            NOTHING ADDED
          </div>
        </div>

        <div className="relative overflow-hidden border-t-[3px] border-[#131118] bg-[#131118] py-3.5 text-[#D8FF3E]">
          <div className="marquee-track font-display text-[26px] uppercase tracking-[0.04em]">
            <span className="pr-10">TEN PHOTOS IN ✱ ONE REEL OUT ✱ NOTHING ADDED ✱ NO CAMERA ✱ NO SITE VISIT ✱&nbsp;</span>
            <span className="pr-10">TEN PHOTOS IN ✱ ONE REEL OUT ✱ NOTHING ADDED ✱ NO CAMERA ✱ NO SITE VISIT ✱&nbsp;</span>
          </div>
        </div>
      </section>

      {/* ============ SHOWCASE ============ */}
      <section id="showcase" className="border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] pb-[100px] pt-[90px] text-[#F1EEE3]">
        <div className="mb-[60px] flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display m-0 max-w-[900px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
            ONE HOUSE. <span className="text-[#D8FF3E]">ITS OWN PHOTOS.</span>
          </h2>
          <p className="font-mono-brand m-0 max-w-[320px] text-[14px] text-[#F1EEE3]/70">
            Every frame below came from photographs already on that listing. Nothing was added to the house.
          </p>
        </div>
        <div className="flex gap-[34px] overflow-x-auto px-2.5 pb-[30px] pt-5">
          {[1, 2, 3, 4, 5].map((n, idx) => (
            <div
              key={n}
              className="w-[380px] flex-[0_0_auto]"
              style={{ transform: ["rotate(-2deg)", "rotate(1.5deg) translateY(18px)", "rotate(-1deg)", "rotate(2deg) translateY(14px)", "rotate(-1.5deg)"][idx] }}
            >
              <div className="font-mono-brand mb-2.5 inline-block border border-[#D8FF3E] bg-[#D8FF3E]/10 px-2.5 py-[3px] text-[12px] font-bold text-[#D8FF3E]">
                SHOT_0{n}
              </div>
              <div className="aspect-video w-[380px] overflow-hidden rounded-[14px] border-[3px] border-[#F1EEE3] bg-[#1E1B26]">
                <video
                  src={`/Videos/property/${n}.mp4`}
                  poster={`/Videos/property/${n}.jpg`}
                  preload="metadata"
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ BENEFITS ============ */}
      <section className="border-b-[3px] border-[#131118]">
        <div className="px-[4vw] pb-[30px] pt-[80px]">
          <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">✱ WHY IT WORKS</div>
        </div>
        {[
          {
            big: "PHOTOS YOU ALREADY OWN",
            copy: "The vendor already paid a photographer. Those files are the entire input — no second shoot, no site visit, no drone, no waiting on anyone's calendar.",
          },
          {
            big: "NOTHING GETS ADDED",
            copy: "The camera moves inside the photograph and never leaves it. No furniture that isn't in the room, no sky that wasn't in the shot. It's your licence on the listing, not ours.",
          },
          {
            big: "MINUTES, NOT WEEKS",
            copy: "Upload the folder, choose your quality, hit generate. The reel is rendering before you've finished your coffee.",
          },
          {
            big: "EVERY LISTING. NOT JUST THE TROPHIES.",
            copy: "When a reel costs a handful of credits, you stop deciding which property deserves one. The three-week-old listing gets a fresh cut too.",
          },
        ].map((b) => (
          <div
            key={b.big}
            className="group grid grid-cols-1 items-center gap-[30px] border-t-[3px] border-[#131118] px-[4vw] py-[44px] transition-colors hover:bg-[#D8FF3E] md:grid-cols-[1fr_minmax(280px,420px)]"
          >
            <div className="font-display leading-[0.95]" style={{ fontSize: "clamp(40px, 6vw, 100px)" }}>{b.big}</div>
            <p className="m-0 text-[18px] font-medium leading-[1.5]">{b.copy}</p>
          </div>
        ))}
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="border-b-[3px] border-[#131118] bg-[#6E2CF4] px-[4vw] pb-[100px] pt-[90px] text-[#F1EEE3]">
        <h2 className="font-display m-0 mb-[70px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
          FOUR STEPS.<br />ONE REEL.
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Upload the photos", c: "Drag in the folder from the listing. One photo becomes one shot, so the count is the reel." },
            { n: "02", t: "Standard or HD", c: "Two buttons. The credit total updates before you commit to anything." },
            { n: "03", t: "Add a family", c: "Choose which living spaces get people in them. Bathrooms and exteriors are never offered." },
            { n: "04", t: "Generate and approve", c: "Every shot comes back beside the photo it came from. You approve each one, or reshoot it." },
          ].map((s) => (
            <div
              key={s.n}
              className="flex flex-col gap-4 border-[3px] border-[#F1EEE3] bg-[#6E2CF4] px-7 pb-11 pt-[34px] transition-colors hover:bg-[#5B21CF]"
            >
              <div className="font-display leading-none text-transparent" style={{ fontSize: "90px", WebkitTextStroke: "2px #F1EEE3" }}>{s.n}</div>
              <div className="text-[24px] font-black uppercase tracking-[0.02em]">{s.t}</div>
              <p className="m-0 text-[16px] leading-[1.5] text-[#F1EEE3]/85">{s.c}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ STATS ============
          Facts about the product, not claims about the market. There is no
          verified figure for video lifting enquiry or price — so we don't print one. */}
      <section className="grid grid-cols-1 gap-[50px] border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] py-[90px] text-[#F1EEE3] sm:grid-cols-3">
        <Stat target={10} suffix="" decimals={0} label="PHOTOS = ONE REEL" />
        <Stat target={1000} suffix="" decimals={0} label="CREDITS EVERY MONTH" />
        <Stat text="NOTHING" label="ADDED TO YOUR LISTING" />
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="border-b-[3px] border-[#131118] px-[4vw] pb-[110px] pt-[90px]">
        <h2 className="font-display m-0 mb-[24px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
          THREE PLANS.<br />
          <span className="text-[#6E2CF4]">TOP UP WHEN YOU NEED IT.</span>
        </h2>
        <p className="font-mono-brand mb-[70px] text-[14px] font-bold tracking-[0.06em]">
          ALL PRICES IN AUD, GST INCLUSIVE.
        </p>
        <div className="grid max-w-[1300px] grid-cols-1 items-stretch gap-8 md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const featured = i === 1;
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col gap-4 border-[3px] border-[#131118] px-8 py-[36px] ${
                  featured ? "bg-[#D8FF3E] shadow-[10px_10px_0_#131118]" : "bg-[#F1EEE3] shadow-[8px_8px_0_#131118]"
                }`}
                style={featured ? { transform: "rotate(-1.2deg)" } : undefined}
              >
                {featured && (
                  <div
                    className="font-mono-brand absolute -top-[18px] right-[22px] border-[3px] border-[#131118] bg-[#6E2CF4] px-3.5 py-[5px] text-[12px] font-bold text-[#F1EEE3]"
                    style={{ transform: "rotate(3deg)" }}
                  >
                    MOST AGENTS
                  </div>
                )}
                <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">
                  {plan.name.replace("HomeReel ", "").toUpperCase()}
                </div>
                <div className="font-display text-[64px] leading-none">
                  ${plan.priceAud}<span className="text-[24px]">/MO</span>
                </div>
                <div className="font-display text-[24px] leading-none text-[#6E2CF4]">
                  {plan.credits.toLocaleString()} credits
                </div>
                <p className="m-0 text-[15px] font-medium leading-[1.5]">{plan.blurb}</p>
                <ul className="m-0 list-disc pl-5 text-[15px] font-medium leading-[1.9]">
                  <li>
                    {Math.floor(plan.credits / (RATES.shot.hd * 10))} HD reel
                    {Math.floor(plan.credits / (RATES.shot.hd * 10)) === 1 ? "" : "s"} of ten shots
                  </li>
                  <li>or {Math.floor(plan.credits / (RATES.shot.sd * 10))} in Standard</li>
                  <li>Approve every shot before it lands</li>
                </ul>
                <Link
                  href="/register"
                  className={`mt-auto block border-[3px] border-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase transition-colors ${
                    featured ? "bg-[#131118] text-[#F1EEE3] hover:bg-[#6E2CF4]" : "hover:bg-[#131118] hover:text-[#F1EEE3]"
                  }`}
                >
                  Choose {plan.name.replace("HomeReel ", "")}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 text-[16px] font-medium">
          <span className="font-mono-brand text-[13px] font-bold tracking-[0.1em]">TOP UP ANY TIME:</span>
          {TOPUPS.map((t) => (
            <span key={t.priceAud}>
              <strong>${t.priceAud}</strong> → {t.credits.toLocaleString()} cr
            </span>
          ))}
          <span className="font-mono-brand text-[12px] text-[#131118]/55">
            HD SHOT {RATES.shot.hd} CR · STANDARD {RATES.shot.sd} CR · FAMILY +{RATES.familyRoom} CR
          </span>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] py-[110px] text-center text-[#F1EEE3]">
        <h2 className="font-display m-0 mb-[50px] leading-[0.95]" style={{ fontSize: "clamp(48px, 8vw, 130px)" }}>
          YOUR LISTING IS SITTING{" "}
          <span className="inline-block bg-[#D8FF3E] px-[0.12em] text-[#131118]" style={{ transform: "rotate(-1.5deg)" }}>PERFECTLY STILL.</span>
        </h2>
        <Link
          href="/register"
          className="inline-block border-[3px] border-[#D8FF3E] bg-[#D8FF3E] px-[46px] py-[22px] text-[20px] font-extrabold uppercase tracking-[0.03em] text-[#131118] shadow-[8px_8px_0_#6E2CF4] transition-colors hover:border-[#F1EEE3] hover:bg-[#F1EEE3]"
        >
          Make your first reel
        </Link>
        <div className="font-mono-brand mt-[22px] text-[13px] text-[#F1EEE3]/60">
          $19 A MONTH ✱ GST INCLUSIVE ✱ CANCEL ANY TIME
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="px-[4vw] pb-10 pt-[70px]">
        <div className="mb-[70px] flex flex-wrap justify-between gap-[60px]">
          <div className="font-display leading-none" style={{ fontSize: "clamp(40px, 5vw, 72px)" }}>
            HOME<span className="text-[#6E2CF4]">✱</span>REEL
          </div>
          <div className="flex flex-wrap gap-[70px]">
            {[
              { h: "PRODUCT", links: [["Showcase", "#showcase"], ["How it works", "#how"], ["Pricing", "#pricing"]] },
              { h: "COMPANY", links: [["About", "#"], ["Contact", "#"]] },
              { h: "LEGAL", links: [["Terms", "#"], ["Privacy", "#"]] },
            ].map((col) => (
              <div key={col.h} className="flex flex-col gap-3">
                <div className="font-mono-brand text-[12px] font-bold tracking-[0.1em] text-[#131118]/50">{col.h}</div>
                {col.links.map(([label, href]) => (
                  <Link key={label} href={href} className="text-[15px] font-semibold hover:text-[#6E2CF4]">{label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="font-mono-brand flex flex-wrap justify-between gap-3 border-t-[3px] border-[#131118] pt-5 text-[12px] font-bold">
          <span>© 2026 HOMEREEL.</span>
          <span>NOTHING ADDED TO YOUR LISTING.</span>
        </div>
      </footer>
    </div>
  );
}
