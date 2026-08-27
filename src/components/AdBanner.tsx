"use client";

import { useEffect, useRef } from "react";

type AdSize =
  | "leaderboard"       // 728×90
  | "large-mobile"      // 320×100
  | "medium-rect"       // 300×250
  | "large-rect"        // 336×280
  | "wide-skyscraper"   // 160×600
  | "half-page";        // 300×600

const SIZE_MAP: Record<AdSize, { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  "large-mobile": { width: 320, height: 100 },
  "medium-rect": { width: 300, height: 250 },
  "large-rect": { width: 336, height: 280 },
  "wide-skyscraper": { width: 160, height: 600 },
  "half-page": { width: 300, height: 600 },
};

const PUB_ID = "ca-pub-3962710606150436";

interface AdBannerProps {
  adSlot: string;
  size: AdSize;
  className?: string;
}

export default function AdBanner({ adSlot, size, className = "" }: AdBannerProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet — will init when script loads
    }
  }, []);

  const { width, height } = SIZE_MAP[size];

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ minWidth: width, minHeight: height }}
      aria-label="Advertisement"
    >
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "inline-block", width, height }}
        data-ad-client={PUB_ID}
        data-ad-slot={adSlot}
      />
    </div>
  );
}
