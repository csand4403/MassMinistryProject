// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gameday/teams?league=college-football
//
// Team list for the favorite / hate-watch pickers. Proxied through the
// provider rather than fetched from ESPN in the browser, so the picker keeps
// working when the data source is swapped.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getProvider } from "@/lib/football/providers";
import { ALL_LEAGUES } from "@/lib/football/config";
import type { LeagueId } from "@/lib/football/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("league");
  const league = (
    ALL_LEAGUES.includes(requested as LeagueId) ? requested : "college-football"
  ) as LeagueId;

  const provider = getProvider();
  if (!provider.fetchTeams) {
    return NextResponse.json(
      { league, teams: [], error: `Provider "${provider.name}" cannot list teams.` },
      { status: 200 }
    );
  }

  try {
    const teams = await provider.fetchTeams(league);
    return NextResponse.json({ league, teams });
  } catch (err) {
    return NextResponse.json(
      {
        league,
        teams: [],
        error: err instanceof Error ? err.message : "Failed to load teams",
      },
      { status: 502 }
    );
  }
}
