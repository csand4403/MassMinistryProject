// ─────────────────────────────────────────────────────────────────────────────
// /gameday — "Get Over There Now"
//
// Standalone live-football dashboard. Shares this Next.js deployment with the
// parish app but none of its auth or chrome (see middleware.ts and AppShell).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { Dashboard } from "@/components/gameday/Dashboard";

export const metadata: Metadata = {
  title: "Get Over There Now",
  description: "Which live football game is most worth watching right now.",
};

// The board is entirely live data; never prerender or cache it.
export const dynamic = "force-dynamic";

export default function GamedayPage() {
  return <Dashboard />;
}
