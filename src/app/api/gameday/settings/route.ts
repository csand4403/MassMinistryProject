// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/gameday/settings — read and update alert settings live.
// Single-user personal tool: no auth, by design (see README).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/football/store";
import { ALL_LEAGUES } from "@/lib/football/config";
import type { LeagueId, TeamRef } from "@/lib/football/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;
  const next: Parameters<typeof updateSettings>[0] = {};

  if (patch.threshold !== undefined) {
    const threshold = Number(patch.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: "threshold must be a number between 0 and 100" },
        { status: 400 }
      );
    }
    next.threshold = Math.round(threshold);
  }

  if (patch.cooldownMs !== undefined) {
    const cooldownMs = Number(patch.cooldownMs);
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
      return NextResponse.json(
        { error: "cooldownMs must be a non-negative number" },
        { status: 400 }
      );
    }
    next.cooldownMs = Math.round(cooldownMs);
  }

  if (patch.ntfyTopic !== undefined) {
    if (typeof patch.ntfyTopic !== "string") {
      return NextResponse.json(
        { error: "ntfyTopic must be a string" },
        { status: 400 }
      );
    }
    next.ntfyTopic = patch.ntfyTopic.trim().slice(0, 100);
  }

  if (patch.leagues !== undefined) {
    if (!Array.isArray(patch.leagues)) {
      return NextResponse.json(
        { error: "leagues must be an array" },
        { status: 400 }
      );
    }
    const leagues = patch.leagues.filter((l): l is LeagueId =>
      ALL_LEAGUES.includes(l as LeagueId)
    );
    if (leagues.length === 0) {
      return NextResponse.json(
        { error: `leagues must include at least one of ${ALL_LEAGUES.join(", ")}` },
        { status: 400 }
      );
    }
    next.leagues = leagues;
  }

  for (const key of ["favorites", "rivals"] as const) {
    if (patch[key] === undefined) continue;
    if (!Array.isArray(patch[key])) {
      return NextResponse.json(
        { error: `${key} must be an array` },
        { status: 400 }
      );
    }
    const parsed = parseTeamRefs(patch[key] as unknown[]);
    if (parsed === null) {
      return NextResponse.json(
        { error: `${key} entries must have league, id, displayName and abbreviation` },
        { status: 400 }
      );
    }
    next[key] = parsed;
  }

  return NextResponse.json(updateSettings(next));
}

/** Validate and normalise a list of saved team references. */
function parseTeamRefs(raw: unknown[]): TeamRef[] | null {
  const out: TeamRef[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const t = entry as Record<string, unknown>;
    if (
      !ALL_LEAGUES.includes(t.league as LeagueId) ||
      typeof t.id !== "string" ||
      typeof t.displayName !== "string" ||
      typeof t.abbreviation !== "string"
    ) {
      return null;
    }
    // Same team picked twice is a no-op, not an error.
    const key = `${t.league}:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      league: t.league as LeagueId,
      id: t.id,
      displayName: t.displayName.slice(0, 120),
      abbreviation: t.abbreviation.slice(0, 12),
      logo: typeof t.logo === "string" ? t.logo : null,
    });
    // A sane ceiling; nobody roots for 60 teams and the bonus is not additive.
    if (out.length >= 20) break;
  }
  return out;
}
