"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ROTATING = ["UNSKIPPABLE", "UNMISSABLE", "UNIGNORABLE", "UNREAL"];

function useRotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 2000);
    return () => clearInterval(t);
  }, []);
  return ROTATING[i];
}

function Stat({ target, suffix, decimals, label }: { target: number; suffix: string; decimals: number; label: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started.current) {
          started.current = true;
          const start = performance.now();
          const dur = 1400;
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const p = 1 - Math.pow(1 - t, 3);
            setVal(target * p);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="border-l-4 border-[#D8FF3E] pl-7">
      <div className="font-display leading-none text-[#D8FF3E]" style={{ fontSize: "clamp(70px, 9vw, 150px)" }}>
        {val.toFixed(decimals)}
        {suffix}
      </div>
      <div className="font-mono-brand mt-3 text-[15px] font-bold tracking-[0.1em]">{label}</div>
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
          UNREAL<span className="text-[#6E2CF4]">✱</span>ADZ
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
            Sign up free
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section
        id="top"
        className="relative flex min-h-[94vh] flex-col justify-end overflow-hidden border-b-[3px] border-[#131118] pt-[90px]"
      >
        <div
          className="font-display pointer-events-none absolute left-[-6%] top-[6%] whitespace-nowrap leading-none text-transparent"
          style={{
            fontSize: "26vw",
            WebkitTextStroke: "2px rgba(19,17,24,0.14)",
            animation: "drift 9s ease-in-out infinite alternate",
          }}
        >
          UNREAL✱
        </div>

        <div className="relative max-w-[1500px] px-[4vw]">
          <div className="anim-rise font-mono-brand mb-[22px] flex items-center gap-3 text-[15px] font-bold tracking-[0.08em]">
            <span className="inline-block h-3 w-3 border-2 border-[#131118] bg-[#D8FF3E]" />
            THE AI UGC AD MACHINE — BUILT FOR THE 2026 FEED
          </div>
          <h1 className="font-display anim-rise m-0 leading-[0.92]" style={{ fontSize: "clamp(64px, 12vw, 200px)" }}>
            <span className="block">MAKE ADS</span>
            <span
              className="inline-block bg-[#D8FF3E] px-[0.12em] pb-[0.02em] shadow-[8px_8px_0_#131118]"
              style={{ transform: "rotate(-1.5deg)" }}
            >
              <span key={word} className="inline-block" style={{ animation: "popIn 0.45s cubic-bezier(0.2,0.9,0.3,1.2) both" }}>
                {word}
              </span>
            </span>
          </h1>
          <div className="anim-rise my-[42px] mb-[60px] flex flex-wrap items-end gap-10">
            <p className="m-0 max-w-[540px] text-[21px] font-medium leading-[1.45]">
              One product photo + one hook = hundreds of scroll-stopping UGC videos. No creators. No shipping. No $500 flops. Rendered in minutes, not weeks.
            </p>
            <div className="flex flex-wrap gap-[18px]">
              <Link
                href="/register"
                className="inline-block border-[3px] border-[#131118] bg-[#131118] px-[34px] py-[18px] text-[18px] font-extrabold uppercase tracking-[0.03em] text-[#F1EEE3] shadow-[6px_6px_0_rgba(19,17,24,0.25)] transition-colors hover:bg-[#6E2CF4]"
              >
                Make my first ad — free
              </Link>
              <Link
                href="#showcase"
                className="inline-block border-[3px] border-[#131118] bg-transparent px-[34px] py-[18px] text-[18px] font-extrabold uppercase tracking-[0.03em] text-[#131118] transition-colors hover:bg-[#D8FF3E]"
              >
                Watch it work
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute right-[4vw] top-[120px] hidden flex-col items-end gap-[18px] sm:flex">
          <div
            className="flex h-[130px] w-[130px] flex-col items-center justify-center rounded-full border-[3px] border-[#131118] bg-[#6E2CF4] text-center text-[#F1EEE3]"
            style={{ animation: "wobble 3.5s ease-in-out infinite alternate" }}
          >
            <span className="font-display text-[34px]">2.7×</span>
            <span className="font-mono-brand text-[11px] font-bold">AVG CTR LIFT</span>
          </div>
          <div
            className="font-mono-brand border-[3px] border-[#131118] bg-[#F1EEE3] px-[18px] py-2.5 text-[13px] font-bold shadow-[5px_5px_0_#131118]"
            style={{ transform: "rotate(6deg)" }}
          >
            NO CREATORS NEEDED
          </div>
        </div>

        <div className="relative overflow-hidden border-t-[3px] border-[#131118] bg-[#131118] py-3.5 text-[#D8FF3E]">
          <div className="marquee-track font-display text-[26px] uppercase tracking-[0.04em]">
            <span className="pr-10">UNREAL SPEED ✱ UNREAL SCALE ✱ UNREAL SALES ✱ ONE PHOTO IN ✱ 100 ADS OUT ✱ ZERO CREATORS ✱&nbsp;</span>
            <span className="pr-10">UNREAL SPEED ✱ UNREAL SCALE ✱ UNREAL SALES ✱ ONE PHOTO IN ✱ 100 ADS OUT ✱ ZERO CREATORS ✱&nbsp;</span>
          </div>
        </div>
      </section>

      {/* ============ TRUSTED BY ============ */}
      <section className="overflow-hidden border-b-[3px] border-[#131118] py-[26px]">
        <div className="font-mono-brand mb-[18px] text-center text-[13px] font-bold tracking-[0.1em]">
          TRUSTED BY BRANDS THAT SHIP
        </div>
        <div className="marquee-track text-[30px] font-black uppercase tracking-[0.02em]" style={{ animationDuration: "28s" }}>
          <span className="pr-12">AIRHUM <span className="text-[#6E2CF4]">✱</span> BUZZ BRANDING <span className="text-[#6E2CF4]">✱</span> CLICKDIGITAL <span className="text-[#6E2CF4]">✱</span> AQ <span className="text-[#6E2CF4]">✱</span> UCONNECT <span className="text-[#6E2CF4]">✱</span> PHOENIX LABS <span className="text-[#6E2CF4]">✱</span>&nbsp;</span>
          <span className="pr-12">AIRHUM <span className="text-[#6E2CF4]">✱</span> BUZZ BRANDING <span className="text-[#6E2CF4]">✱</span> CLICKDIGITAL <span className="text-[#6E2CF4]">✱</span> AQ <span className="text-[#6E2CF4]">✱</span> UCONNECT <span className="text-[#6E2CF4]">✱</span> PHOENIX LABS <span className="text-[#6E2CF4]">✱</span>&nbsp;</span>
        </div>
      </section>

      {/* ============ SHOWCASE ============ */}
      <section id="showcase" className="border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] pb-[100px] pt-[90px] text-[#F1EEE3]">
        <div className="mb-[60px] flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display m-0 max-w-[900px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
            FRESH OUT OF THE <span className="text-[#D8FF3E]">AD MACHINE</span>
          </h2>
          <p className="font-mono-brand m-0 max-w-[300px] text-[14px] text-[#F1EEE3]/70">
            Real renders, straight from the engine. This is what lands in the feed.
          </p>
        </div>
        <div className="flex gap-[34px] overflow-x-auto px-2.5 pb-[30px] pt-5">
          {[1, 2, 3, 4, 5].map((n, idx) => (
            <div
              key={n}
              className="w-[250px] flex-[0_0_auto]"
              style={{ transform: ["rotate(-3deg)", "rotate(2deg) translateY(18px)", "rotate(-1.5deg)", "rotate(3deg) translateY(14px)", "rotate(-2.5deg)"][idx] }}
            >
              <div className="font-mono-brand mb-2.5 inline-block border border-[#D8FF3E] bg-[#D8FF3E]/10 px-2.5 py-[3px] text-[12px] font-bold text-[#D8FF3E]">
                AD_00{n}.MP4
              </div>
              <div className="h-[444px] w-[250px] overflow-hidden rounded-[22px] border-[3px] border-[#F1EEE3] bg-[#1E1B26]">
                <video
                  src={`/Videos/webm/${n}.webm`}
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
          <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">✱ THE MATH IS BRUTAL</div>
        </div>
        {[
          { big: "$500 → $5", copy: "The cost of a converting ad just collapsed. Stop paying influencer prices for coin-flip results." },
          { big: "3 WEEKS → 3 MIN", copy: "From product shot to rendered video before your coffee goes cold. Test today, scale tomorrow." },
          { big: "1 PHOTO → 100 ADS", copy: "Every hook, persona and placement — generated, not negotiated. Endless variations that actually convert." },
          { big: "NO MODELS. NO FILMING.", copy: "No shipping products to strangers. No chasing creators for edits. Upload, type, render, run." },
        ].map((b) => (
          <div
            key={b.big}
            className="group grid grid-cols-1 items-center gap-[30px] border-t-[3px] border-[#131118] px-[4vw] py-[44px] transition-colors hover:bg-[#D8FF3E] md:grid-cols-[1fr_minmax(280px,420px)]"
          >
            <div className="font-display leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 120px)" }}>{b.big}</div>
            <p className="m-0 text-[18px] font-medium leading-[1.5]">{b.copy}</p>
          </div>
        ))}
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="border-b-[3px] border-[#131118] bg-[#6E2CF4] px-[4vw] pb-[100px] pt-[90px] text-[#F1EEE3]">
        <h2 className="font-display m-0 mb-[70px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
          FOUR STEPS.<br />ZERO EXCUSES.
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Pick your ad style", c: "UGC, product-only, or both. Choose the format the algorithm rewards." },
            { n: "02", t: "Spawn a persona", c: "Upload a face or generate one from scratch. Your perfect creator, on demand." },
            { n: "03", t: "Write the hook", c: "AI co-writes dialogue that grabs attention in the first 1.5 seconds." },
            { n: "04", t: "Render the video", c: "Your style, your location, your way. Export ready for every placement." },
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

      {/* ============ STATS ============ */}
      <section className="grid grid-cols-1 gap-[50px] border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] py-[90px] text-[#F1EEE3] sm:grid-cols-3">
        <Stat target={2.7} suffix="×" decimals={1} label="CLICK-THROUGH RATE" />
        <Stat target={1.7} suffix="×" decimals={1} label="RETURN ON AD SPEND" />
        <Stat target={90} suffix="%" decimals={0} label="FASTER PRODUCTION" />
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="border-b-[3px] border-[#131118] px-[4vw] pb-[110px] pt-[90px]">
        <h2 className="font-display m-0 mb-[70px] leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 110px)" }}>
          PRICED LIKE A TOOL.<br />
          <span className="text-[#6E2CF4]">NOT AN AGENCY.</span>
        </h2>
        <div className="grid max-w-[1300px] grid-cols-1 items-stretch gap-10 md:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col gap-5 border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[38px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">TEST DRIVE</div>
            <div className="font-display text-[72px] leading-none">$0</div>
            <ul className="m-0 list-disc pl-5 text-[16px] font-medium leading-[2]">
              <li>3 ads per month</li>
              <li>All ad styles</li>
              <li>Watermarked exports</li>
            </ul>
            <Link href="/register" className="mt-auto block border-[3px] border-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase transition-colors hover:bg-[#131118] hover:text-[#F1EEE3]">
              Start free
            </Link>
          </div>
          {/* Operator (featured) */}
          <div className="relative flex flex-col gap-5 border-[3px] border-[#131118] bg-[#D8FF3E] px-8 py-[38px] shadow-[10px_10px_0_#131118]" style={{ transform: "rotate(-1.2deg)" }}>
            <div className="font-mono-brand absolute -top-[18px] right-[22px] border-[3px] border-[#131118] bg-[#6E2CF4] px-3.5 py-[5px] text-[12px] font-bold text-[#F1EEE3]" style={{ transform: "rotate(3deg)" }}>
              MOST POPULAR
            </div>
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">OPERATOR</div>
            <div className="font-display text-[72px] leading-none">$49<span className="text-[26px]">/MO</span></div>
            <ul className="m-0 list-disc pl-5 text-[16px] font-medium leading-[2]">
              <li>100 ads per month</li>
              <li>HD, no watermark</li>
              <li>AI hook writer</li>
              <li>Persona library</li>
            </ul>
            <Link href="/register" className="mt-auto block border-[3px] border-[#131118] bg-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase text-[#F1EEE3] transition-colors hover:bg-[#6E2CF4]">
              Go Operator
            </Link>
          </div>
          {/* Agency */}
          <div className="flex flex-col gap-5 border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[38px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">AGENCY</div>
            <div className="font-display text-[72px] leading-none">$199<span className="text-[26px]">/MO</span></div>
            <ul className="m-0 list-disc pl-5 text-[16px] font-medium leading-[2]">
              <li>Unlimited brands</li>
              <li>White-label exports</li>
              <li>Team seats</li>
              <li>Priority rendering</li>
            </ul>
            <Link href="/register" className="mt-auto block border-[3px] border-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase transition-colors hover:bg-[#131118] hover:text-[#F1EEE3]">
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="border-b-[3px] border-[#131118] bg-[#131118] px-[4vw] py-[110px] text-center text-[#F1EEE3]">
        <h2 className="font-display m-0 mb-[50px] leading-[0.95]" style={{ fontSize: "clamp(48px, 8vw, 130px)" }}>
          YOUR COMPETITORS ARE ALREADY{" "}
          <span className="inline-block bg-[#D8FF3E] px-[0.12em] text-[#131118]" style={{ transform: "rotate(-1.5deg)" }}>RENDERING.</span>
        </h2>
        <Link
          href="/register"
          className="inline-block border-[3px] border-[#D8FF3E] bg-[#D8FF3E] px-[46px] py-[22px] text-[20px] font-extrabold uppercase tracking-[0.03em] text-[#131118] shadow-[8px_8px_0_#6E2CF4] transition-colors hover:border-[#F1EEE3] hover:bg-[#F1EEE3]"
        >
          Start free — no card needed
        </Link>
        <div className="font-mono-brand mt-[22px] text-[13px] text-[#F1EEE3]/60">
          FREE PLAN AVAILABLE ✱ FIRST AD IN UNDER 5 MINUTES
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="px-[4vw] pb-10 pt-[70px]">
        <div className="mb-[70px] flex flex-wrap justify-between gap-[60px]">
          <div className="font-display leading-none" style={{ fontSize: "clamp(40px, 5vw, 72px)" }}>
            UNREAL<span className="text-[#6E2CF4]">✱</span>ADZ
          </div>
          <div className="flex flex-wrap gap-[70px]">
            {[
              { h: "PRODUCT", links: [["Showcase", "#showcase"], ["How it works", "#how"], ["Pricing", "#pricing"]] },
              { h: "COMPANY", links: [["About", "#"], ["Careers", "#"], ["Contact", "#"]] },
              { h: "LEGAL", links: [["Terms", "#"], ["Privacy", "#"]] },
              { h: "SOCIAL", links: [["Twitter / X", "#"], ["YouTube", "#"], ["LinkedIn", "#"]] },
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
          <span>© 2026 UNREALADZ. ALL ADS UNREAL.</span>
          <span>MADE TO STOP THUMBS.</span>
        </div>
      </footer>
    </div>
  );
}
