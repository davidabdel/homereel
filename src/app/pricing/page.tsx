"use client";

import { useState } from "react";

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  // Pull Stripe Payment Link URLs from env (set in UGC/.env.local)
  const links = {
    lite: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_LITE_MONTHLY || "#",
      annual: process.env.NEXT_PUBLIC_STRIPE_LINK_LITE_ANNUAL || "#",
    },
    business: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_BUSINESS_MONTHLY || "#",
      annual: process.env.NEXT_PUBLIC_STRIPE_LINK_BUSINESS_ANNUAL || "#",
    },
    heavy: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_HEAVY_MONTHLY || "#",
      annual: process.env.NEXT_PUBLIC_STRIPE_LINK_HEAVY_ANNUAL || "#",
    },
  } as const;

  const plans = [
    {
      name: "Free",
      price: "$0",
      monthlyPrice: "$0",
      annualPrice: "$0",
      badge: "",
      cta: "Start free",
      features: [
        "100 credits per month",
        "Basic UGC generation",
        "Community support",
      ],
      monthlyLink: "#",
      annualLink: "#",
    },
    {
      name: "Lite",
      price: "$99",
      monthlyPrice: "$99",
      annualPrice: "$999",
      badge: "Most popular",
      cta: "Upgrade",
      features: [
        "50,000 credits per month",
        "HD quality renders",
        "Priority processing",
        "Advanced tools",
        "Email support",
      ],
      monthlyLink: links.lite.monthly,
      annualLink: links.lite.annual,
    },
    {
      name: "Business",
      price: "$299",
      monthlyPrice: "$299",
      annualPrice: "$2999",
      badge: "",
      cta: "Upgrade",
      features: [
        "150,000 credits per month",
        "Team collaboration",
        "API access",
        "Priority support",
        "Faster queues",
      ],
      monthlyLink: links.business.monthly,
      annualLink: links.business.annual,
    },
    {
      name: "Heavy",
      price: "$799",
      monthlyPrice: "$799",
      annualPrice: "$7999",
      badge: "New",
      cta: "Contact sales",
      features: [
        "400,000 credits per month",
        "Dedicated capacity",
        "Higher priority",
        "SLA options",
      ],
      monthlyLink: links.heavy.monthly,
      annualLink: links.heavy.annual,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F1EEE3] text-[#131118]">
      <header className="border-b-[3px] border-[#131118] bg-[#131118] text-[#F1EEE3]">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h1 className="font-display leading-[0.95]" style={{ fontSize: "clamp(44px,7vw,90px)" }}>
            PRICED LIKE A TOOL.<br /><span className="text-[#D8FF3E]">NOT AN AGENCY.</span>
          </h1>
          <p className="mt-4 text-[#F1EEE3]/80">
            Simple plans that scale with you. Switch billing period anytime.
          </p>

          <div className="font-mono-brand mt-7 inline-flex items-center gap-1 border-[3px] border-[#F1EEE3] p-1 text-sm font-bold uppercase">
            <button
              className={`px-4 py-1.5 transition ${annual ? "bg-[#D8FF3E] text-[#131118]" : "bg-transparent text-[#F1EEE3]"}`}
              onClick={() => setAnnual(true)}
            >
              Annual <span className="ml-1 text-[10px]">(save)</span>
            </button>
            <button
              className={`px-4 py-1.5 transition ${!annual ? "bg-[#D8FF3E] text-[#131118]" : "bg-transparent text-[#F1EEE3]"}`}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const featured = p.badge === "Most popular";
            return (
              <div
                key={p.name}
                className={`flex flex-col border-[3px] border-[#131118] p-8 shadow-[8px_8px_0_#131118] ${featured ? "bg-[#D8FF3E]" : "bg-[#F1EEE3]"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono-brand text-[13px] font-bold uppercase tracking-[0.1em]">{p.name}</div>
                  {p.badge && (
                    <span className="font-mono-brand border-[2px] border-[#131118] bg-[#6E2CF4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F1EEE3]">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="font-display mt-4 text-[56px] leading-none">
                  {annual ? p.annualPrice : p.monthlyPrice}
                  <span className="text-[20px]">{annual ? "/YR" : "/MO"}</span>
                </div>
                <div className="mt-1 text-xs text-[#131118]/60">Billed {annual ? "yearly" : "monthly"}</div>
                <ul className="mt-5 space-y-2 text-sm font-medium">
                  {p.features.slice(0, 10).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 border border-[#131118] bg-[#6E2CF4]"></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={annual ? (p.annualLink || "#") : (p.monthlyLink || "#")}
                  className="mt-6 block border-[3px] border-[#131118] bg-[#131118] py-3.5 text-center text-[15px] font-extrabold uppercase text-[#F1EEE3] transition-colors hover:bg-[#6E2CF4]"
                  target={annual ? (p.annualLink && p.annualLink !== "#" ? "_blank" : undefined) : (p.monthlyLink && p.monthlyLink !== "#" ? "_blank" : undefined)}
                  rel="noreferrer"
                >
                  {p.cta}
                </a>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { h: "NOTES", items: ["Credit counts vary by operation.", "Fair-use policy protects platform stability.", "Priority rendering on paid plans."] },
            { h: "BILLING", items: ["Cancel anytime; proration may apply.", "Taxes/VAT calculated at checkout.", "Manage via Stripe customer portal."] },
            { h: "SUPPORT", items: ["Email support on paid plans.", "Priority support on Business+.", "Dedicated CSM on Heavy."] },
          ].map((col) => (
            <div key={col.h} className="border-[3px] border-[#131118] bg-[#F1EEE3] p-6 text-sm">
              <div className="font-mono-brand font-bold uppercase tracking-[0.1em]">{col.h}</div>
              <ul className="mt-3 space-y-1.5 font-medium text-[#131118]/80">
                {col.items.map((i) => (
                  <li key={i}>✱ {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
