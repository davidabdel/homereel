"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserCredits } from "@/lib/subscription-service";
import { PLANS, TOPUPS, RATES } from "@/lib/pricing";

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  extreme: process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTREME,
  topup_20: process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_20,
  topup_50: process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50,
  topup_100: process.env.NEXT_PUBLIC_STRIPE_PRICE_TOPUP_100,
};

export default function CreditsPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserCredits(user.id).then((r) => {
      if (r.success && r.credits) setCredits(r.credits.spendable);
      else setCredits(0);
    });
  }, [user]);

  async function buy(key: string) {
    const priceId = PRICE_IDS[key];
    if (!priceId) {
      setError("That option isn't configured yet.");
      return;
    }
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Could not start checkout");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display m-0 leading-[0.95]" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
          CREDITS
        </h1>
        <div className="font-mono-brand border-[3px] border-[#131118] bg-[#D8FF3E] px-4 py-2 text-[15px] font-bold">
          BALANCE: {credits === null ? "…" : credits.toLocaleString()} CR
        </div>
      </div>

      <p className="m-0 mb-9 max-w-[720px] text-[17px] font-medium leading-[1.5]">
        An HD shot is {RATES.shot.hd} credits, a Standard shot {RATES.shot.sd}, and a family in a room
        {" "}{RATES.familyRoom} more. One photo is one shot — so a ten-shot HD reel is{" "}
        {10 * RATES.shot.hd} credits. All prices AUD, GST inclusive.
      </p>

      {error && (
        <div className="mb-7 border-[3px] border-[#131118] bg-[#6E2CF4] px-5 py-4 text-[16px] font-bold text-[#F1EEE3]">
          {error}
        </div>
      )}

      <div className="font-mono-brand mb-4 text-[13px] font-bold tracking-[0.1em]">MONTHLY PLANS</div>
      <div className="mb-14 grid grid-cols-1 gap-7 md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const featured = i === 1;
          const hdReels = Math.floor(plan.credits / (RATES.shot.hd * 10));
          return (
            <div
              key={plan.key}
              className={`flex flex-col gap-4 border-[3px] border-[#131118] px-7 py-8 ${
                featured ? "bg-[#D8FF3E] shadow-[8px_8px_0_#131118]" : "bg-[#F1EEE3] shadow-[6px_6px_0_#131118]"
              }`}
            >
              <div className="font-mono-brand text-[13px] font-bold tracking-[0.1em]">
                {plan.name.replace("HomeReel ", "").toUpperCase()}
              </div>
              <div className="font-display text-[54px] leading-none">
                ${plan.priceAud}
                <span className="text-[20px]">/MO</span>
              </div>
              <div className="font-display text-[22px] leading-none text-[#6E2CF4]">
                {plan.credits.toLocaleString()} credits
              </div>
              <p className="m-0 text-[15px] font-medium leading-[1.5]">
                {hdReels} HD reel{hdReels === 1 ? "" : "s"} of ten shots a month.
              </p>
              <button
                type="button"
                onClick={() => void buy(plan.key)}
                disabled={busy !== null}
                className="mt-auto border-[3px] border-[#131118] bg-[#131118] py-3 text-[15px] font-extrabold uppercase text-[#F1EEE3] transition-colors hover:bg-[#6E2CF4] disabled:opacity-40"
              >
                {busy === plan.key ? "Opening…" : `Choose ${plan.name.replace("HomeReel ", "")}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="font-mono-brand mb-4 text-[13px] font-bold tracking-[0.1em]">
        TOP UP — ONE OFF, VALID 12 MONTHS
      </div>
      <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
        {TOPUPS.map((t) => (
          <div
            key={t.priceAud}
            className="flex flex-col gap-3 border-[3px] border-[#131118] bg-[#F1EEE3] px-7 py-7 shadow-[6px_6px_0_#131118]"
          >
            <div className="font-display text-[42px] leading-none">${t.priceAud}</div>
            <div className="font-display text-[20px] leading-none text-[#6E2CF4]">
              {t.credits.toLocaleString()} credits
            </div>
            <button
              type="button"
              onClick={() => void buy(`topup_${t.priceAud}`)}
              disabled={busy !== null}
              className="mt-2 border-[3px] border-[#131118] py-3 text-[15px] font-extrabold uppercase transition-colors hover:bg-[#131118] hover:text-[#F1EEE3] disabled:opacity-40"
            >
              {busy === `topup_${t.priceAud}` ? "Opening…" : "Buy credits"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
