"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  className?: string;
  rounded?: string; // tailwind rounded class
  poster?: string;
  ariaLabel?: string;
  autoplayOnViewMobile?: boolean; // when true, first in-view mobile video auto-plays
};

export default function HoverPlayVideo({ src, className = "", rounded = "rounded-xl", poster, ariaLabel, autoplayOnViewMobile = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Desktop: hover play/pause
    function onEnter() {
      const v = ref.current;
      if (!v) return;
      v.muted = true; // ensure muted for autoplay policies
      v.play().catch(() => {});
    }
    function onLeave() {
      const v = ref.current;
      if (!v) return;
      v.pause();
      v.currentTime = 0;
    }

    // Mobile behavior: tap-to-play, only one plays at a time, optional auto-play first in view
    let observer: IntersectionObserver | null = null;
    function pauseSelf() {
      const v = ref.current;
      if (!v) return;
      v.pause();
    }
    function onGlobalPlay(e: Event) {
      const detail = (e as CustomEvent<HTMLVideoElement>).detail;
      const v = ref.current;
      if (!v) return;
      if (detail !== v) {
        v.pause();
        v.currentTime = 0;
      }
    }
    function requestPlay() {
      const v = ref.current;
      if (!v) return;
      v.muted = true;
      v.play().catch(() => {});
      window.dispatchEvent(new CustomEvent<HTMLVideoElement>("hpv:play", { detail: v }));
    }
    function onTap() {
      requestPlay();
    }

    if (isTouch) {
      video.addEventListener("click", onTap);
      window.addEventListener("hpv:play", onGlobalPlay as EventListener);
      if (autoplayOnViewMobile && "IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                requestPlay();
              } else {
                pauseSelf();
              }
            }
          },
          { threshold: [0, 0.25, 0.6, 0.75, 1] }
        );
        observer.observe(video);
      }
    } else {
      // Desktop hover
      video.addEventListener("mouseenter", onEnter);
      video.addEventListener("mouseleave", onLeave);
    }

    return () => {
      if (isTouch) {
        video.removeEventListener("click", onTap);
        window.removeEventListener("hpv:play", onGlobalPlay as EventListener);
        if (observer) observer.disconnect();
      } else {
        video.removeEventListener("mouseenter", onEnter);
        video.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [autoplayOnViewMobile]);

  return (
    <video
      ref={ref}
      className={className}
      aria-label={ariaLabel}
      muted
      playsInline
      preload="metadata"
      loop
      poster={poster}
    >
      <source src={src} type="video/webm" />
    </video>
  );
}
