"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Numbers that change without startling anybody.
//
// Real-time dashboards suffer from two opposite failures: values that hard-cut
// (so a change is missed entirely — "change blindness") and values that blink
// (so everything is noise). The middle ground is a short count-up plus a brief
// tint on the direction of travel.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

const COUNT_MS = 450;

export function AnimatedNumber({
  value,
  className = "",
  /** Tailwind classes applied briefly when the value rises / falls. */
  upClass = "",
  downClass = "",
}: {
  value: number;
  className?: string;
  upClass?: string;
  downClass?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const fromRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    setFlash(value > from ? "up" : "down");
    const flashTimer = setTimeout(() => setFlash(null), 900);

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      // easeOutCubic — fast to start, settles gently.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(flashTimer);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value]);

  const flashClass = flash === "up" ? upClass : flash === "down" ? downClass : "";

  return (
    <span className={`tabular-nums transition-colors duration-300 ${className} ${flashClass}`}>
      {display}
    </span>
  );
}

/**
 * Wraps content and pulses its background when `pulseKey` changes — used to
 * mark the card whose score just moved.
 */
export function ChangePulse({
  pulseKey,
  className = "",
  children,
}: {
  pulseKey: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const firstRef = useRef(true);

  useEffect(() => {
    // Don't pulse on mount — only on genuine subsequent changes.
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setActive(true);
    const timer = setTimeout(() => setActive(false), 1100);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  return (
    <div
      className={`${className} transition-[background-color,box-shadow] duration-700 ${
        active ? "bg-amber-400/10 ring-amber-400/40" : ""
      }`}
    >
      {children}
    </div>
  );
}
