// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gameday/health — liveness probe for the host platform.
//
// Deliberately does NOT hit the upstream provider: a health check that fails
// because ESPN is briefly down would get the container restarted, which is the
// opposite of helpful. It reports engine state instead, and starts the poller
// so a platform that pings health on wake brings the board up before the first
// visitor arrives.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { isRunning, startPolling } from "@/lib/football/poller";
import { engine } from "@/lib/football/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  startPolling();
  const state = engine();
  return NextResponse.json({
    ok: true,
    polling: isRunning(),
    lastPollAt: state.lastPollAt,
    lastPollError: state.lastPollError,
    trackedGames: state.ranked.length,
    uptimeSeconds: Math.round(process.uptime()),
  });
}
