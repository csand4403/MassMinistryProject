// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gameday — current ranked slate.
//
// Starts the poll loop on first request (so simply opening the dashboard is
// enough to bring the engine up) and returns the freshest snapshot available.
// Clients that cannot use SSE can poll this endpoint directly.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { buildSnapshot, isRunning, pollOnce, startPolling } from "@/lib/football/poller";
import { engine } from "@/lib/football/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const wasRunning = isRunning();
  startPolling();

  // Cold start: nothing has been fetched yet, so do one synchronous poll
  // rather than handing the dashboard an empty board.
  if (!wasRunning && engine().lastPollAt === null) {
    const snapshot = await pollOnce();
    return NextResponse.json(snapshot);
  }

  return NextResponse.json(buildSnapshot());
}
