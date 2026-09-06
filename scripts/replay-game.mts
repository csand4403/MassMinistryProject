#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Replay a FINISHED game through the excitement algorithm.
//
//   npm run replay -- <espn-game-id> [--league nfl|college-football]
//
// Why this exists: the dashboard can only judge games that happen while it is
// running. To tune the formula you want to point it at a game whose drama you
// already know and check that the score spikes where it should — and stays low
// where it shouldn't.
//
// It pulls ESPN's per-play win-probability timeline for the game, feeds each
// play through the SAME `computeExcitement` the live engine uses (no
// reimplementation — that would defeat the point), and prints the curve plus
// the top moments.
//
// Find a game id from any ESPN box score URL:
//   espn.com/nfl/game/_/gameId/401547353  ->  401547353
// ─────────────────────────────────────────────────────────────────────────────

import { EspnProvider } from "../src/lib/football/providers/espn.ts";
import { computeExcitement } from "../src/lib/football/excitement.ts";
import type { LeagueId, LiveGame } from "../src/lib/football/types.ts";
import type { WinProbSample } from "../src/lib/football/excitement.ts";

const args = process.argv.slice(2);
const gameId = args.find((a) => !a.startsWith("--"));
const leagueFlag = args.indexOf("--league");
const league: LeagueId =
  leagueFlag >= 0 && args[leagueFlag + 1]
    ? (args[leagueFlag + 1] as LeagueId)
    : "nfl";

if (!gameId) {
  console.error(
    "Usage: npm run replay -- <espn-game-id> [--league nfl|college-football]"
  );
  process.exit(1);
}

/**
 * Real polls arrive on a wall clock, but a replay walks play-by-play. We
 * synthesise a timestamp per play so the volatility window (which is
 * time-based) behaves as it would live: roughly one play every 25 seconds of
 * real time, which is about how often a scoreboard poll sees a new play.
 */
const SECONDS_PER_PLAY = 25;

const provider = new EspnProvider();
const plays = await provider.fetchWinProbabilityTimeline(league, gameId);

if (plays.length === 0) {
  console.error(
    `No win-probability data for game ${gameId} in ${league}. ` +
      `Check the id and league, or try a more recent season.`
  );
  process.exit(1);
}

console.log(`Replaying ${plays.length} plays from ${league} game ${gameId}\n`);

const t0 = Date.now() - plays.length * SECONDS_PER_PLAY * 1000;
const history: WinProbSample[] = [];
const rows: {
  i: number;
  t: number;
  score: number;
  wp: number;
  clock: string;
  period: number | null;
  home: number;
  away: number;
  headline: string;
  text: string;
}[] = [];

plays.forEach((play, i) => {
  const t = t0 + i * SECONDS_PER_PLAY * 1000;
  history.push({ t, homeWinProbability: play.homeWinProbability });

  // Build a minimal LiveGame standing in for this instant of the game.
  const game: LiveGame = {
    id: `${league}:${gameId}`,
    league,
    state: "in",
    home: blankTeam("HOME", play.homeScore),
    away: blankTeam("AWAY", play.awayScore),
    period: play.period,
    displayClock: play.clock,
    clockSeconds: null,
    secondsRemaining: play.secondsRemaining,
    statusDetail: null,
    isOvertime: (play.period ?? 0) > 4,
    // Play-by-play only contains live snaps, so nothing here is stopped.
    isStopped: false,
    homeWinProbability: play.homeWinProbability,
    situation: {
      down: play.down,
      distance: play.distance,
      isRedZone: play.isRedZone,
      yardsToGoal: play.yardsToGoal,
      possessionTeamId: null,
      downDistanceText: null,
      lastPlayText: play.text,
      lastPlayType: null,
    },
    broadcasts: [],
    gamecastUrl: null,
    startDate: null,
    fetchedAt: t,
  };

  const result = computeExcitement(game, history, t);
  rows.push({
    i,
    t,
    score: result.score,
    wp: play.homeWinProbability,
    clock: play.clock ?? "—",
    period: play.period,
    home: play.homeScore,
    away: play.awayScore,
    headline: result.headline,
    text: (play.text ?? "").slice(0, 70),
  });
});

// ── The curve ───────────────────────────────────────────────────────────────
console.log("Excitement over the course of the game (each row = one play):\n");
const BAR_WIDTH = 50;
// Print every Nth play so a 180-play game fits on a screen.
const stride = Math.max(1, Math.ceil(rows.length / 60));
for (let i = 0; i < rows.length; i += stride) {
  const r = rows[i];
  const filled = Math.round((r.score / 100) * BAR_WIDTH);
  const bar = "█".repeat(filled) + "·".repeat(BAR_WIDTH - filled);
  const q = r.period ? `Q${r.period}` : "  ";
  console.log(
    `${String(r.score).padStart(3)} |${bar}| ${q} ${r.clock.padStart(5)}  ` +
      `${String(r.away).padStart(2)}-${String(r.home).padEnd(2)} wp=${(r.wp * 100).toFixed(0).padStart(3)}%`
  );
}

// ── Peak moments ────────────────────────────────────────────────────────────
const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 10);
console.log("\nTop 10 moments by excitement:\n");
for (const r of top) {
  const q = r.period ? `Q${r.period}` : "?";
  console.log(
    `  ${String(r.score).padStart(3)}  ${q} ${r.clock.padStart(5)}  ` +
      `${r.away}-${r.home}  ${r.headline}`
  );
  if (r.text) console.log(`       ${r.text}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────
const peak = Math.max(...rows.map((r) => r.score));
const mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
const q4 = rows.filter((r) => (r.period ?? 0) >= 4);
const q4Mean = q4.length
  ? q4.reduce((s, r) => s + r.score, 0) / q4.length
  : 0;
const q1 = rows.filter((r) => (r.period ?? 0) === 1);
const q1Mean = q1.length
  ? q1.reduce((s, r) => s + r.score, 0) / q1.length
  : 0;

console.log(`
Summary
  plays          ${rows.length}
  peak           ${peak}
  mean           ${mean.toFixed(1)}
  mean Q1        ${q1Mean.toFixed(1)}
  mean Q4/OT     ${q4Mean.toFixed(1)}
  final          ${rows[rows.length - 1].away}-${rows[rows.length - 1].home}

A well-tuned formula should show mean Q4/OT well above mean Q1 for a close
game, and a low peak for a blowout. Adjust EXCITEMENT_CONFIG in
src/lib/football/excitement.ts and re-run.`);

function blankTeam(abbr: string, score: number) {
  return {
    id: abbr,
    abbreviation: abbr,
    name: abbr,
    displayName: abbr,
    score,
    color: null,
    logo: null,
    record: null,
  };
}
