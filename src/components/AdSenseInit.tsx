"use client";

import { useEffect } from "react";

export default function AdSenseInit() {
  useEffect(() => {
    try {
      const ins = document.querySelectorAll<HTMLElement>("ins.adsbygoogle");
      ins.forEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      });
    } catch {
      // AdSense script not yet loaded — it will auto-init via the async script
    }
  }, []);

  return null;
}
