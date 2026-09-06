// ─────────────────────────────────────────────────────────────────────────────
// Get Over There Now — core domain types
//
// These types are deliberately PROVIDER-AGNOSTIC.  Nothing in here mentions
// ESPN.  A provider (see providers/types.ts) is responsible for mapping some
// upstream API's payload onto `LiveGame`, and every other layer of the app
// (scoring, ranking, UI, alerting) only ever sees `LiveGame`.
//
// That is what makes the data source swappable: to move to SportsDataIO or
// SportRadar you write one new file implementing `ScoreboardProvider` and
// change one line in providers/index.ts.  Nothing else changes.
// ─────────────────────────────────────────────────────────────────────────────

/** Which league a game belongs to. Add more as providers gain support. */
export type LeagueId = "nfl" | "college-football";

/** Coarse game state, normalised across providers. */
export type GameState = "pre" | "in" | "post";

/** One side of a game. */
export interface Team {
  /** Provider-specific id — used to match against `possessionTeamId`. */
  id: string;
  /** Short code, e.g. "KC". */
  abbreviation: string;
  /** e.g. "Chiefs" */
  name: string;
  /** e.g. "Kansas City Chiefs" */
  displayName: string;
  /** Points scored so far. */
  score: number;
  /** Primary team colour as a hex string WITHOUT the leading '#', if known. */
  color: string | null;
  logo: string | null;
  /** e.g. "11-3" — may be absent. */
  record: string | null;
  /**
   * AP/coaches poll rank, 1-25, or null when unranked or not applicable.
   * Used to detect upsets (an unranked team beating a top-10 team), which the
   * hate-watch scoring cares about a great deal.
   */
  rank: number | null;
}

/**
 * A user's reference to a specific team, as stored in settings.
 *
 * Carries the display fields as well as the id because the settings UI needs
 * to render the chip without re-fetching the whole 700-team league list, and
 * because it keeps saved preferences readable if you ever open the JSON.
 */
export interface TeamRef {
  league: LeagueId;
  /** Provider team id, e.g. ESPN's "194" for Ohio State. */
  id: string;
  displayName: string;
  abbreviation: string;
  logo: string | null;
}

/**
 * Which side of a game the user cares about, and why.
 * `null` on both means this game is fandom-neutral.
 */
export interface FandomMatch {
  /** Side the user roots FOR, if any. */
  favorite: "home" | "away" | null;
  /** Side the user roots AGAINST — the hate watch. */
  rival: "home" | "away" | null;
  /** Points contributed by fandom, already included in the final score. */
  bonus: number;
}

/**
 * Down-and-distance / field-position state.
 *
 * Every field is nullable: real scoreboards routinely omit these between
 * plays, during halftime, and on kickoffs.  Consumers must degrade
 * gracefully rather than assume presence.
 */
export interface Situation {
  /** 1-4, or null when not a scrimmage down (kickoff, PAT, between drives). */
  down: number | null;
  /** Yards to go for a first down. */
  distance: number | null;
  /** True when the offence is inside the opponent's 20. */
  isRedZone: boolean;
  /**
   * Distance to the goal line for the team with the ball, in yards.
   * Used to detect goal-line stands. Null when unknown.
   */
  yardsToGoal: number | null;
  /** Team id of whoever has the ball, or null if unknown. */
  possessionTeamId: string | null;
  /** e.g. "4th & Goal at KC 2" — provider-formatted, display only. */
  downDistanceText: string | null;
  /** Free-text description of the most recent play, if exposed. */
  lastPlayText: string | null;
  /** Provider's label for the last play type, e.g. "Punt", "Penalty". */
  lastPlayType: string | null;
}

/**
 * A single game as the rest of the app understands it.
 *
 * `homeWinProbability` is the ONE number the excitement algorithm most wants,
 * and it is the one most often missing — small-conference college games
 * frequently expose no win probability at all.  When it is null the scorer
 * falls back to a score-margin proxy (see excitement.ts).
 */
export interface LiveGame {
  /** Stable unique id, namespaced by league to avoid cross-league collisions. */
  id: string;
  league: LeagueId;
  state: GameState;
  home: Team;
  away: Team;
  /** 1-4 in regulation; >4 indicates overtime. */
  period: number | null;
  /** Clock remaining in the current period, e.g. "0:42". */
  displayClock: string | null;
  /** Seconds remaining in the current period. */
  clockSeconds: number | null;
  /**
   * Seconds remaining in the whole game (regulation).  Either taken from the
   * provider or derived from period + clock.  Null when unknowable.
   */
  secondsRemaining: number | null;
  /** Human status line, e.g. "0:42 - 4th Quarter". */
  statusDetail: string | null;
  /** True when period > 4. */
  isOvertime: boolean;
  /**
   * True when the game is nominally "in progress" but the ball is NOT in play:
   * halftime, a weather delay, or the break between quarters.
   *
   * Providers lump these in with live action (ESPN reports STATUS_DELAYED and
   * STATUS_HALFTIME under state "in"), but there is nothing to run to during a
   * rain delay, so the scorer damps these heavily.
   */
  isStopped: boolean;
  /**
   * Probability that the HOME team wins, 0..1. Null when the provider does
   * not expose win probability for this game.
   */
  homeWinProbability: number | null;
  situation: Situation | null;
  /** National/major TV networks carrying the game. */
  broadcasts: string[];
  /** Link to the provider's gamecast — the "Get Over There" fallback target. */
  gamecastUrl: string | null;
  /** Kickoff time, ISO 8601. */
  startDate: string | null;
  /** When this snapshot was taken (ms epoch). */
  fetchedAt: number;
}

/** A single point on a game's win-probability / excitement timeline. */
export interface TimelinePoint {
  /** ms epoch */
  t: number;
  /** Home win probability 0..1 at this instant, if known. */
  homeWinProbability: number | null;
  /** Excitement score 0..100 at this instant. */
  excitement: number;
  /** Seconds remaining in the game at this instant, if known. */
  secondsRemaining: number | null;
  homeScore: number;
  awayScore: number;
}

/** A game plus its computed excitement, as served to the dashboard. */
export interface RankedGame {
  game: LiveGame;
  excitement: ExcitementResult;
  /** Recent excitement values, oldest first — drives the card sparkline. */
  sparkline: number[];
  /** Excitement delta vs. ~1 minute ago; positive means heating up. */
  trend: number;
}

/**
 * Full output of the excitement algorithm — deliberately returns its own
 * intermediate terms so the UI can explain itself and so the formula can be
 * tuned against real games rather than by vibes.
 */
export interface ExcitementResult {
  /** Final 0-100 score. */
  score: number;
  /** 0..1 — how close the game is right now. */
  closeness: number;
  /** 0..1 — how violently win probability has swung recently. */
  volatility: number;
  /** 0..1 — how late/high-leverage the game moment is. */
  urgency: number;
  /**
   * Urgency rescaled into TIME_FLOOR..1 — the factor closeness is multiplied
   * by. 1.0 means "this moment counts fully"; TIME_FLOOR means "it's early".
   */
  timeWeight: number;
  /** Situational bonus points added on top of the leveraged base. */
  situationBonus: number;
  /** Short human tags, e.g. ["4th & Goal", "Red zone", "0:42 left"]. */
  reasons: string[];
  /** One-line "why it's exciting" summary for the card. */
  headline: string;
  /** True when closeness came from the score-margin fallback, not win prob. */
  usedFallbackCloseness: boolean;
  /**
   * Personal-interest adjustment. Zero for anyone with no teams configured —
   * the objective score is the default experience.
   */
  fandom: FandomMatch;
  /**
   * The score BEFORE any fandom adjustment and before the stopped-play
   * multiplier. Exposed so each browser can re-apply its OWN team preferences
   * to a shared snapshot — see personalizeScore() in excitement.ts. Without
   * this, two people on one shared URL would fight over one set of teams.
   */
  objectiveScore: number;
  /** Damping applied for halftime / delays. 1 when the ball is in play. */
  stoppedMultiplier: number;
}
