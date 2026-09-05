// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gameday/history — excitement timelines recorded this session.
//
// Lets you check after the fact whether the algorithm actually spiked at the
// moments that mattered. `?gameId=` returns a single game's timeline.
// For validating against games that finished BEFORE the engine was running,
// use scripts/replay-game.mjs instead.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getAllTimelines, getLabel, getTimeline } from "@/lib/football/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get("gameId");

  if (gameId) {
    return NextResponse.json({
      gameId,
      label: getLabel(gameId),
      points: getTimeline(gameId),
    });
  }

  const all = getAllTimelines();
  return NextResponse.json({
    games: Object.entries(all).map(([id, points]) => ({
      gameId: id,
      label: getLabel(id),
      points,
      peak: points.reduce((max, p) => Math.max(max, p.excitement), 0),
    })),
  });
}
