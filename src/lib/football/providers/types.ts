// ─────────────────────────────────────────────────────────────────────────────
// The data-source seam.
//
// Everything the app needs from the outside world is expressed by this one
// interface.  Swapping ESPN for SportsDataIO / SportRadar / a local fixture
// file means writing one more implementation and registering it in index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { LeagueId, LiveGame, TeamRef, TimelinePoint } from "../types";

export interface ScoreboardProvider {
  /** Short machine name, e.g. "espn". Surfaced in /api/gameday for debugging. */
  readonly name: string;

  /** Leagues this provider can serve. */
  readonly supportedLeagues: readonly LeagueId[];

  /**
   * Fetch every game on the scoreboard for the given leagues.
   *
   * Implementations SHOULD return games in all states (pre/in/post) and let
   * the caller filter — the poller wants to know about games about to start.
   * Implementations MUST NOT throw for a single bad league; return what you
   * can and let partial data through.
   */
  fetchScoreboard(leagues: readonly LeagueId[]): Promise<LiveGame[]>;

  /**
   * Optional: list every team in a league, for the favorite / hate-watch
   * pickers. Providers that cannot enumerate teams should omit this; the UI
   * degrades to showing only teams currently on the board.
   */
  fetchTeams?(league: LeagueId): Promise<TeamRef[]>;

  /**
   * Optional: fetch a historical per-play win-probability timeline for one
   * finished game.  Used by the replay harness to validate the excitement
   * algorithm against known classic finishes.  Providers that cannot do this
   * should simply omit the method.
   */
  fetchWinProbabilityTimeline?(
    league: LeagueId,
    gameId: string
  ): Promise<HistoricalPlay[]>;
}

/** One play from a completed game, used for offline algorithm replay. */
export interface HistoricalPlay {
  playId: string;
  homeWinProbability: number;
  /** Seconds remaining in regulation, if the provider exposes it. */
  secondsRemaining: number | null;
  period: number | null;
  clock: string | null;
  homeScore: number;
  awayScore: number;
  text: string | null;
  down: number | null;
  distance: number | null;
  isRedZone: boolean;
  yardsToGoal: number | null;
}

export type { TimelinePoint };
