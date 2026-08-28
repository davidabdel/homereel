"use client";

import Link from "next/link";
import { PLANS, RATES, TOPUPS, TOPUP_VALIDITY_MONTHS } from "@/lib/pricing";

/**
 * One membership, then top up. Deliberately not a tiered allowance — an
 * allowance hands out credits every month whether they're used or not, and the
 * liability is unbounded. A prepaid wallet can't cost more than it brought in.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F1EEE3] px-[4vw] py-16 text-[#131118]">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/" className="font-display mb-10 inline-block text-[24px]">
          HOME<span className="text-[#6E2CF4]">✱</span>REEL
        </Link>

        <h1 className="font-display m-0 leading-[0.95]" style={{ fontSize: "clamp(44px, 7vw, 96px)" }}>
          THREE PLANS.
          <br />
          <span className="text-[#6E2CF4]">TOP UP WHEN YOU NEED IT.</span>
        </h1>
        <p className="font-mono-brand mt-4 text-[14px] font-bold tracking-[0.06em]">
          ALL PRICES IN AUD, GST INCLUSIVE.
        </p>

        {/* Rendered from PLANS so the page and the ledger can never disagree. */}
        <div className="mt-14 grid grid-cols-1 items-stretch gap-8 md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const featured = i === 1;
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col gap-5 border-[3px] border-[#131118] px-8 py-[38px] ${
                  featured
                    ? "bg-[#D8FF3E] shadow-[10px_10px_0_#131118]"
                    : "bg-[#F1EEE3] shadow-[8px_8px_0_#131118]"
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
                  ${plan.priceAud}
                  <span className="text-[24px]">/MO</span>
                </div>
                <div className="font-display text-[26px] leading-none text-[#6E2CF4]">
                  {plan.credits.toLocaleString()} credits
                </div>
                <p className="m-0 text-[16px] font-medium leading-[1.5]">{plan.blurb}</p>
                <ul className="m-0 list-disc pl-5 text-[15px] font-medium leading-[1.9]">
                  <li>
                    {Math.floor(plan.credits / (RATES.shot.hd * 10))} HD reel
                    {Math.floor(plan.credits / (RATES.shot.hd * 10)) === 1 ? "" : "s"} of ten shots
                  </li>
                  <li>or {Math.floor(plan.credits / (RATES.shot.sd * 10))} in Standard</li>
                  <li>Family in the living spaces</li>
                  <li>Approve every shot before it lands</li>
                </ul>
                <Link
                  href="/register"
                  className={`mt-auto block border-[3px] border-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase transition-colors ${
                    featured
                      ? "bg-[#131118] text-[#F1EEE3] hover:bg-[#6E2CF4]"
                      : "hover:bg-[#131118] hover:text-[#F1EEE3]"
                  }`}
                >
                  Choose {plan.name.replace("HomeReel ", "")}
                </Link>
              </div>
            );
          })}
        </div>

        {/* what a shot costs, plus top-ups */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[34px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand mb-4 text-[14px] font-bold tracking-[0.1em]">WHAT A SHOT COSTS</div>
            <ul className="m-0 list-none p-0 text-[16px] font-medium leading-[2.1]">
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>High Definition shot</span><span className="font-bold">{RATES.shot.hd} cr</span>
              </li>
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>Standard shot</span><span className="font-bold">{RATES.shot.sd} cr</span>
              </li>
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>Family in a room</span><span className="font-bold">+{RATES.familyRoom} cr</span>
              </li>
            </ul>
            <div className="font-mono-brand mt-4 text-[13px] text-[#131118]/60">
              ONE PHOTO = ONE SHOT.
            </div>
          </div>
          <div className="border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[34px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand mb-4 text-[14px] font-bold tracking-[0.1em]">BUSY MONTH? TOP UP</div>
            <ul className="m-0 list-none p-0 text-[16px] font-medium leading-[2.1]">
              {TOPUPS.map((t) => (
                <li key={t.priceAud} className="flex justify-between border-b border-[#131118]/20">
                  <span>${t.priceAud}</span>
                  <span className="font-bold">{t.credits.toLocaleString()} cr</span>
                </li>
              ))}
            </ul>
            <div className="font-mono-brand mt-4 text-[13px] text-[#131118]/60">
              MONTHLY CREDITS EXPIRE MONTHLY. TOP-UPS LAST {TOPUP_VALIDITY_MONTHS} MONTHS.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
