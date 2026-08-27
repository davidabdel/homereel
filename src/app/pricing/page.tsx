"use client";

import Link from "next/link";
import { MEMBERSHIP, RATES, TOPUPS, TOPUP_VALIDITY_MONTHS } from "@/lib/pricing";

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
          ONE MEMBERSHIP.
          <br />
          <span className="text-[#6E2CF4]">TOP UP WHEN YOU NEED IT.</span>
        </h1>
        <p className="font-mono-brand mt-4 text-[14px] font-bold tracking-[0.06em]">
          ALL PRICES IN AUD, GST INCLUSIVE.
        </p>

        <div className="mt-14 grid grid-cols-1 items-stretch gap-10 md:grid-cols-3">
          {/* what a film costs */}
          <div className="flex flex-col gap-5 border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[38px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">WHAT A FILM COSTS</div>
            <div className="font-display text-[58px] leading-none">
              {RATES.shot.hd}
              <span className="text-[20px]"> CR</span>
            </div>
            <div className="text-[16px] font-medium">per High Definition shot</div>
            <ul className="m-0 list-none p-0 text-[16px] font-medium leading-[2.1]">
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>Standard shot</span><span className="font-bold">{RATES.shot.sd} cr</span>
              </li>
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>High Definition shot</span><span className="font-bold">{RATES.shot.hd} cr</span>
              </li>
              <li className="flex justify-between border-b border-[#131118]/20">
                <span>Family in a room</span><span className="font-bold">+{RATES.familyRoom} cr</span>
              </li>
            </ul>
            <div className="font-mono-brand mt-auto pt-2 text-[13px] text-[#131118]/60">
              ONE PHOTO = ONE SHOT. A TEN-SHOT HD FILM IS {10 * RATES.shot.hd} CREDITS.
            </div>
          </div>

          {/* membership */}
          <div
            className="relative flex flex-col gap-5 border-[3px] border-[#131118] bg-[#D8FF3E] px-8 py-[38px] shadow-[10px_10px_0_#131118]"
            style={{ transform: "rotate(-1.2deg)" }}
          >
            <div
              className="font-mono-brand absolute -top-[18px] right-[22px] border-[3px] border-[#131118] bg-[#6E2CF4] px-3.5 py-[5px] text-[12px] font-bold text-[#F1EEE3]"
              style={{ transform: "rotate(3deg)" }}
            >
              MEMBERSHIP
            </div>
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">HOMEREEL</div>
            <div className="font-display text-[72px] leading-none">
              ${MEMBERSHIP.priceAud}
              <span className="text-[26px]">/MO</span>
            </div>
            <ul className="m-0 list-disc pl-5 text-[16px] font-medium leading-[2]">
              <li>{MEMBERSHIP.creditsPerMonth.toLocaleString()} credits every month</li>
              <li>Standard or High Definition</li>
              <li>Family in the living spaces</li>
              <li>Approve every shot before it lands</li>
              <li>Films stored and re-downloadable</li>
            </ul>
            <Link
              href="/register"
              className="mt-auto block border-[3px] border-[#131118] bg-[#131118] py-3.5 text-center text-[16px] font-extrabold uppercase text-[#F1EEE3] transition-colors hover:bg-[#6E2CF4]"
            >
              Become a member
            </Link>
          </div>

          {/* top ups */}
          <div className="flex flex-col gap-5 border-[3px] border-[#131118] bg-[#F1EEE3] px-8 py-[38px] shadow-[8px_8px_0_#131118]">
            <div className="font-mono-brand text-[14px] font-bold tracking-[0.1em]">BUSY MONTH?</div>
            <div className="font-display text-[58px] leading-none">TOP UP</div>
            <ul className="m-0 list-none p-0 text-[16px] font-medium leading-[2.1]">
              {TOPUPS.map((t) => (
                <li key={t.priceAud} className="flex justify-between border-b border-[#131118]/20">
                  <span>${t.priceAud}</span>
                  <span className="font-bold">{t.credits.toLocaleString()} cr</span>
                </li>
              ))}
            </ul>
            <div className="font-mono-brand mt-auto pt-2 text-[13px] text-[#131118]/60">
              MONTHLY CREDITS EXPIRE MONTHLY. TOP-UPS LAST {TOPUP_VALIDITY_MONTHS} MONTHS.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
