// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gameday/test-alert — send a test notification.
// Confirms the ntfy topic works without waiting for a real 80+ game.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { channelsFor, dispatch } from "@/lib/football/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const configured = channelsFor().map((c) => c.name);
  if (configured.length === 0) {
    return NextResponse.json(
      {
        delivered: [],
        configured,
        message:
          "No server-side channel configured. Set an ntfy topic to get alerts on your phone; browser notifications still work.",
      },
      { status: 200 }
    );
  }

  const delivered = await dispatch({
    title: "Get Over There Now — test alert",
    message: "If you can read this, your alerts are wired up correctly.",
    score: 85,
    url: process.env.APP_BASE_URL ?? null,
  });

  return NextResponse.json({
    delivered,
    configured,
    message:
      delivered.length > 0
        ? `Test alert sent via ${delivered.join(", ")}.`
        : "Channel configured but delivery failed — check the server logs.",
  });
}
