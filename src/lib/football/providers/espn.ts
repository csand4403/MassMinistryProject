// ─────────────────────────────────────────────────────────────────────────────
// ESPN scoreboard provider.
//
// Uses ESPN's public (undocumented, unauthenticated) site API:
//
//   GET /apis/site/v2/sports/football/{league}/scoreboard
//   GET /apis/site/v2/sports/football/{league}/summary?event={id}
//
// Why the scoreboard endpoint alone is enough for live polling:
// a live event embeds `competitions[0].situation.lastPlay.probability`, which
// carries `homeWinPercentage` and `secondsLeft`.  So ONE request per league
// per poll yields scores, clock, down/distance, red zone, possession AND win
// probability for every live game.  No per-game fan-out required.
//
// Field quirks discovered against live data (do not "clean these up"):
//   • `situation.down` uses -1 and 0 as sentinels for "not a scrimmage down"
//     (kickoffs, PATs, between drives). Only 1-4 are real downs.
//   • `situation.yardLine` is measured from the POSSESSING team's own goal
//     line, so yards-to-goal is `100 - yardLine`. Verified against ESPN's own
//     `isRedZone` flag across live games: every red-zone game had
//     100 - yardLine <= 20 and no non-red-zone game did.
//   • `situation` and `probability` are frequently ABSENT — in a sample of 19
//     live college games, 17 had a situation and only 15 had win probability.
//     Every accessor here therefore degrades to null rather than throwing.
// ─────────────────────────────────────────────────────────────────────────────

import type { LeagueId, LiveGame, GameState, Team, Situation } from "../types";
import type { ScoreboardProvider, HistoricalPlay } from "./types";

const API_ROOT = "https://site.api.espn.com/apis/site/v2/sports/football";

/** Maps our league ids onto ESPN's path segments. */
const ESPN_LEAGUE_PATH: Record<LeagueId, string> = {
  nfl: "nfl",
  "college-football": "college-football",
};

/**
 * ESPN "group" filters. 80 = FBS (I-A). Without this the college scoreboard
 * returns only a small featured subset rather than the full slate.
 */
const COLLEGE_GROUPS = "80";

/**
 * ESPN status names that sit under state "in" but mean the ball is NOT in
 * play. Confirmed against live data: a Saturday slate showed STATUS_DELAYED
 * alongside STATUS_IN_PROGRESS, both reporting state "in".
 */
const STOPPED_STATUS_NAMES = new Set([
  "STATUS_HALFTIME",
  "STATUS_DELAYED",
  "STATUS_END_PERIOD",
  "STATUS_RAIN_DELAY",
]);

/** Regulation is four 15-minute quarters in both supported leagues. */
const PERIOD_SECONDS = 900;
const REGULATION_PERIODS = 4;

export class EspnProvider implements ScoreboardProvider {
  readonly name = "espn";
  readonly supportedLeagues = ["nfl", "college-football"] as const;

  async fetchScoreboard(leagues: readonly LeagueId[]): Promise<LiveGame[]> {
    // Fetch leagues in parallel; a failure in one must not sink the others.
    const results = await Promise.allSettled(
      leagues.map((league) => this.fetchLeague(league))
    );

    const games: LiveGame[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        games.push(...result.value);
      } else {
        console.error(
          `[espn] scoreboard fetch failed for ${leagues[i]}:`,
          result.reason
        );
      }
    });
    return games;
  }

  private async fetchLeague(league: LeagueId): Promise<LiveGame[]> {
    const path = ESPN_LEAGUE_PATH[league];
    const params = new URLSearchParams({ limit: "300" });
    if (league === "college-football") params.set("groups", COLLEGE_GROUPS);

    const url = `${API_ROOT}/${path}/scoreboard?${params}`;
    const res = await fetch(url, {
      // Always hit the network: a cached scoreboard defeats the whole app.
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`ESPN ${league} scoreboard returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as EspnScoreboard;
    const events = Array.isArray(body?.events) ? body.events : [];

    // Map each event defensively — one malformed event must not lose the slate.
    const games: LiveGame[] = [];
    for (const event of events) {
      try {
        const game = mapEvent(event, league);
        if (game) games.push(game);
      } catch (err) {
        console.error(`[espn] failed to map event ${event?.id}:`, err);
      }
    }
    return games;
  }

  /**
   * Per-play win probability for a COMPLETED game, used by the replay
   * harness (scripts/replay-game.mjs) to sanity-check the algorithm against
   * games whose finishes we already know.
   */
  async fetchWinProbabilityTimeline(
    league: LeagueId,
    gameId: string
  ): Promise<HistoricalPlay[]> {
    const path = ESPN_LEAGUE_PATH[league];
    const url = `${API_ROOT}/${path}/summary?event=${encodeURIComponent(gameId)}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`ESPN summary returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as EspnSummary;

    // The win-probability array is keyed by playId only, so join it against
    // the play-by-play in `drives` to recover clock/score/down context.
    const playsById = new Map<string, EspnPlay>();
    const driveGroups = [
      ...(body.drives?.previous ?? []),
      ...(body.drives?.current ? [body.drives.current] : []),
    ];
    for (const drive of driveGroups) {
      for (const play of drive?.plays ?? []) {
        if (play?.id) playsById.set(String(play.id), play);
      }
    }

    const out: HistoricalPlay[] = [];
    for (const wp of body.winprobability ?? []) {
      if (typeof wp?.homeWinPercentage !== "number") continue;
      const play = playsById.get(String(wp.playId));
      const period = play?.period?.number ?? null;
      const clockSeconds = parseClock(play?.clock?.displayValue ?? null);
      out.push({
        playId: String(wp.playId),
        homeWinProbability: wp.homeWinPercentage,
        secondsRemaining: deriveSecondsRemaining(period, clockSeconds),
        period,
        clock: play?.clock?.displayValue ?? null,
        homeScore: play?.homeScore ?? 0,
        awayScore: play?.awayScore ?? 0,
        text: play?.text ?? null,
        down: normaliseDown(play?.start?.down ?? null),
        distance: play?.start?.distance ?? null,
        // ESPN's play-level `yardsToEndzone` is already goal-relative.
        isRedZone:
          typeof play?.start?.yardsToEndzone === "number"
            ? play.start.yardsToEndzone <= 20
            : false,
        yardsToGoal: play?.start?.yardsToEndzone ?? null,
      });
    }
    return out;
  }
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

function mapEvent(event: EspnEvent, league: LeagueId): LiveGame | null {
  const comp = event?.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors ?? [];
  const homeRaw = competitors.find((c) => c.homeAway === "home");
  const awayRaw = competitors.find((c) => c.homeAway === "away");
  if (!homeRaw || !awayRaw) return null;

  const status = comp.status ?? event.status;
  const period = status?.period ?? null;
  const clockSeconds = normaliseClockSeconds(status);
  const state = (status?.type?.state ?? "pre") as GameState;

  const situationRaw = comp.situation;
  const probability = situationRaw?.lastPlay?.probability;

  // Prefer ESPN's own seconds-left (it accounts for quirks like untimed
  // downs); fall back to deriving it from period + clock.
  const secondsRemaining =
    typeof probability?.secondsLeft === "number"
      ? probability.secondsLeft
      : deriveSecondsRemaining(period, clockSeconds);

  return {
    id: `${league}:${event.id}`,
    league,
    state,
    home: mapTeam(homeRaw),
    away: mapTeam(awayRaw),
    period,
    displayClock: status?.displayClock ?? null,
    clockSeconds,
    secondsRemaining,
    statusDetail: status?.type?.detail ?? status?.type?.shortDetail ?? null,
    isOvertime: typeof period === "number" && period > REGULATION_PERIODS,
    isStopped: STOPPED_STATUS_NAMES.has(status?.type?.name ?? ""),
    homeWinProbability:
      typeof probability?.homeWinPercentage === "number"
        ? clamp01(probability.homeWinPercentage)
        : null,
    situation: mapSituation(situationRaw),
    broadcasts: mapBroadcasts(comp),
    gamecastUrl: pickGamecastUrl(event),
    startDate: event.date ?? comp.date ?? null,
    fetchedAt: Date.now(),
  };
}

function mapTeam(raw: EspnCompetitor): Team {
  const team = raw.team ?? ({} as EspnTeam);
  return {
    id: String(team.id ?? raw.id ?? ""),
    abbreviation: team.abbreviation ?? team.shortDisplayName ?? "—",
    name: team.name ?? team.shortDisplayName ?? "Unknown",
    displayName: team.displayName ?? team.name ?? "Unknown",
    score: toInt(raw.score),
    color: team.color ?? null,
    logo: team.logo ?? null,
    // records[0] is the overall record; the rest are home/away splits.
    record: raw.records?.[0]?.summary ?? null,
  };
}

function mapSituation(raw: EspnSituation | undefined): Situation | null {
  if (!raw) return null;
  const yardLine = typeof raw.yardLine === "number" ? raw.yardLine : null;
  return {
    down: normaliseDown(raw.down ?? null),
    distance: typeof raw.distance === "number" ? raw.distance : null,
    isRedZone: raw.isRedZone === true,
    // See header note: yardLine is measured from the possessing team's goal.
    yardsToGoal: yardLine === null ? null : 100 - yardLine,
    possessionTeamId: raw.possession != null ? String(raw.possession) : null,
    downDistanceText: raw.downDistanceText ?? null,
    lastPlayText: raw.lastPlay?.text ?? null,
    lastPlayType: raw.lastPlay?.type?.text ?? null,
  };
}

function mapBroadcasts(comp: EspnCompetition): string[] {
  const names = new Set<string>();
  for (const b of comp.broadcasts ?? []) {
    for (const n of b?.names ?? []) if (n) names.add(n);
  }
  for (const g of comp.geoBroadcasts ?? []) {
    const n = g?.media?.shortName;
    if (n) names.add(n);
  }
  return Array.from(names);
}

function pickGamecastUrl(event: EspnEvent): string | null {
  const links = event.links ?? [];
  const gamecast = links.find((l) => l?.rel?.includes("summary"));
  return gamecast?.href ?? links[0]?.href ?? null;
}

/**
 * ESPN reports -1 and 0 for "no active down". Only 1-4 are meaningful, and
 * treating the sentinels as real downs would fire bogus 4th-down bonuses.
 */
function normaliseDown(down: number | null): number | null {
  if (typeof down !== "number") return null;
  return down >= 1 && down <= 4 ? down : null;
}

function normaliseClockSeconds(status: EspnStatus | undefined): number | null {
  if (typeof status?.clock === "number") return status.clock;
  return parseClock(status?.displayClock ?? null);
}

/** "12:34" -> 754 seconds. Returns null for anything unparseable. */
function parseClock(display: string | null): number | null {
  if (!display) return null;
  const match = /^(\d+):(\d{2})$/.exec(display.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Seconds left in regulation. Overtime returns 0 — from a "how urgent is
 * this" perspective, OT is maximally urgent, which is what the scorer wants.
 */
function deriveSecondsRemaining(
  period: number | null,
  clockSeconds: number | null
): number | null {
  if (period === null || clockSeconds === null) return null;
  if (period > REGULATION_PERIODS) return 0;
  const fullPeriodsLeft = REGULATION_PERIODS - period;
  return Math.max(0, fullPeriodsLeft * PERIOD_SECONDS + clockSeconds);
}

function toInt(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// ── Minimal structural types for the slice of ESPN's payload we consume ─────
// Deliberately loose: ESPN adds and removes fields without notice, so we only
// name what we read and treat everything as optional.

interface EspnScoreboard {
  events?: EspnEvent[];
}
interface EspnEvent {
  id?: string;
  date?: string;
  links?: { rel?: string[]; href?: string }[];
  status?: EspnStatus;
  competitions?: EspnCompetition[];
}
interface EspnCompetition {
  date?: string;
  status?: EspnStatus;
  competitors?: EspnCompetitor[];
  situation?: EspnSituation;
  broadcasts?: { names?: string[] }[];
  geoBroadcasts?: { media?: { shortName?: string } }[];
}
interface EspnStatus {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: { state?: string; name?: string; detail?: string; shortDetail?: string };
}
interface EspnCompetitor {
  id?: string;
  homeAway?: string;
  score?: string | number;
  team?: EspnTeam;
  records?: { summary?: string }[];
}
interface EspnTeam {
  id?: string;
  abbreviation?: string;
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  logo?: string;
}
interface EspnSituation {
  down?: number;
  distance?: number;
  yardLine?: number;
  isRedZone?: boolean;
  possession?: string | number;
  downDistanceText?: string;
  lastPlay?: {
    text?: string;
    type?: { text?: string };
    probability?: {
      homeWinPercentage?: number;
      awayWinPercentage?: number;
      secondsLeft?: number;
    };
  };
}
interface EspnSummary {
  winprobability?: { homeWinPercentage?: number; playId?: string }[];
  drives?: { previous?: EspnDrive[]; current?: EspnDrive };
}
interface EspnDrive {
  plays?: EspnPlay[];
}
interface EspnPlay {
  id?: string;
  text?: string;
  homeScore?: number;
  awayScore?: number;
  period?: { number?: number };
  clock?: { displayValue?: string };
  start?: { down?: number; distance?: number; yardsToEndzone?: number };
}
