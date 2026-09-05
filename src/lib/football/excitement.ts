// ─────────────────────────────────────────────────────────────────────────────
// THE EXCITEMENT ALGORITHM
//
// Produces a 0-100 score answering one question: "if I could only watch one
// game right now, how badly do I want it to be this one?"
//
// ══ THE FORMULA ══════════════════════════════════════════════════════════════
//
//   timeWeight = TIME_FLOOR + (1 - TIME_FLOOR) * urgency
//   tension    = W_CLOSENESS * closeness * timeWeight + W_VOLATILITY * volatility
//   score      = clamp(100 * tension + situationBonus, 0, 100)
//
// Four inputs, each normalised to 0..1:
//
//   closeness   How near the game is to a coin flip.
//               1 - 2*|homeWinProb - 0.5|  ->  1.0 at 50/50, 0.0 at 100/0.
//               When win probability is unavailable (common in smaller
//               college games) this falls back to a score-margin proxy.
//
//   volatility  How violently win probability has SWUNG recently. This is the
//               term that separates "tense but static 50/50 slog" from
//               "three lead changes in four minutes". Computed as the sum of
//               absolute win-prob changes across the last VOLATILITY_WINDOW_MS,
//               normalised so that VOLATILITY_FULL_SCALE of cumulative swing
//               saturates the term.
//
//   urgency     How late and therefore how high-leverage the moment is.
//               Curved with URGENCY_CURVE so the 4th quarter dominates.
//               Overtime pins this to 1.0.
//
//   timeWeight  Urgency rescaled into TIME_FLOOR..1 and applied to CLOSENESS
//               ONLY. This is the key design decision, and it does two jobs:
//
//                 • It satisfies "a close game with 2 min left outweighs a
//                   close game in the 1st quarter": identical closeness is
//                   worth TIME_FLOOR as much at kickoff as at the whistle.
//                 • Because it multiplies closeness, a late BLOWOUT still
//                   scores ~0. Urgency can only amplify a game that is
//                   already close; it can never manufacture interest in a
//                   38-point game just because the clock is short.
//
//               Volatility is deliberately NOT time-weighted. A swing is
//               already an intrinsically "something just happened" signal, and
//               a wild back-and-forth shootout in the 2nd quarter genuinely is
//               worth switching to.
//
//   situationBonus  Flat points for the specific things that make you shout at
//               a television: red zone, 4th down, goal-line stands, the
//               two-minute warning, overtime, onside kicks. Additive so they
//               can push a merely-good game over an alert threshold, and
//               capped (MAX_SITUATION_BONUS) so they can never manufacture
//               excitement on their own — a red-zone trip in a 40-point
//               blowout is worth a handful of points and nothing more.
//
// ══ TUNING ═══════════════════════════════════════════════════════════════════
// Every constant below is exported in EXCITEMENT_CONFIG. Change them, then run
//   node scripts/replay-game.mjs <espn-game-id>
// to replay a real finished game through the scorer and see where it spikes.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExcitementResult,
  LiveGame,
  TimelinePoint,
} from "./types";

// ── Tunable constants ───────────────────────────────────────────────────────

export const EXCITEMENT_CONFIG = {
  /** Weight of raw closeness in the base score. W_CLOSENESS + W_VOLATILITY = 1. */
  W_CLOSENESS: 0.6,
  /** Weight of recent win-probability swing in the base score. */
  W_VOLATILITY: 0.4,

  /**
   * How far back to look when measuring win-probability swing.
   * 5 minutes of wall-clock ≈ the last few drives.
   */
  VOLATILITY_WINDOW_MS: 5 * 60 * 1000,
  /**
   * Cumulative absolute win-prob movement (in probability units) that
   * saturates the volatility term. 0.6 = 60 percentage points of total swing
   * inside the window, e.g. two full lead changes.
   */
  VOLATILITY_FULL_SCALE: 0.6,

  /**
   * Exponent on remaining-time fraction. Higher = later game matters more.
   * 2.5 means the last quarter carries roughly half of all urgency.
   */
  URGENCY_CURVE: 2.5,
  /**
   * How much a close game is worth at the OPENING KICKOFF relative to the
   * final seconds. 0.45 means early-game closeness pays 45% of what the same
   * closeness pays with no time left. Raise it if the dashboard ignores good
   * early games; lower it if it over-rates 0-0 first quarters.
   */
  TIME_FLOOR: 0.45,

  /** Situational bonus points (additive, before the cap below). */
  BONUS_RED_ZONE: 6,
  BONUS_FOURTH_DOWN: 5,
  BONUS_GOAL_LINE_STAND: 10,
  BONUS_TWO_MINUTE: 8,
  BONUS_OVERTIME: 12,
  BONUS_ONSIDE_KICK: 10,
  /** Team with the ball is trailing -> a live comeback drive is underway. */
  BONUS_COMEBACK_DRIVE: 4,
  /**
   * Largest deficit that still counts as a comeback drive. Beyond roughly two
   * possessions the team with the ball is not mounting a comeback, it is
   * playing out a loss, and awarding it excitement points is simply wrong.
   */
  COMEBACK_MAX_DEFICIT: 16,
  /** Ceiling on total situational bonus, so tags alone can't fake a great game. */
  MAX_SITUATION_BONUS: 25,

  /** Inside this many yards from the goal counts as goal-line. */
  GOAL_LINE_YARDS: 5,
  /** Seconds remaining that count as "two-minute" territory. */
  TWO_MINUTE_SECONDS: 120,

  /**
   * Score-margin fallback: margin (in points) at which the fallback closeness
   * hits zero. A 3-point game reads as very close; a 21-point game as dead.
   */
  FALLBACK_MARGIN_ZERO: 21,

  /**
   * Multiplier applied when the game is stopped — halftime, a weather delay,
   * or between quarters. Nothing is happening, so a tied game at halftime must
   * not be the thing the dashboard tells you to run to. Not zero: a 0-0 game
   * heading into the 3rd quarter is still worth knowing about.
   */
  STOPPED_PLAY_MULTIPLIER: 0.35,

  /** Regulation length in seconds, used to normalise urgency. */
  REGULATION_SECONDS: 3600,
} as const;

export type ExcitementConfig = typeof EXCITEMENT_CONFIG;

/** A win-probability observation used for volatility. */
export interface WinProbSample {
  t: number;
  homeWinProbability: number;
}

// ── Individual terms ────────────────────────────────────────────────────────

/**
 * Closeness from win probability: 1.0 at a coin flip, 0.0 at a decided game.
 */
export function closenessFromWinProb(homeWinProbability: number): number {
  return clamp01(1 - 2 * Math.abs(homeWinProbability - 0.5));
}

/**
 * Fallback closeness when the provider exposes no win probability.
 *
 * Uses the score margin, tightened as the game runs down: a 10-point game in
 * the 1st quarter is wide open, but the same margin with two minutes left is
 * nearly over. `timeFraction` is the share of the game still remaining (1 at
 * kickoff, 0 at the whistle).
 */
export function closenessFromMargin(
  margin: number,
  timeFraction: number,
  config: ExcitementConfig = EXCITEMENT_CONFIG
): number {
  const absMargin = Math.abs(margin);
  // Effective margin grows as time runs out — the same deficit means more.
  // At kickoff a 14-point lead is ~1 possession of "real" separation; with
  // 0:00 left it is insurmountable.
  const timePressure = 1 + 1.5 * (1 - clamp01(timeFraction));
  const effective = absMargin * timePressure;
  return clamp01(1 - effective / config.FALLBACK_MARGIN_ZERO);
}

/**
 * Urgency: how late in the game we are, curved so late minutes dominate.
 * Returns 1.0 for overtime or when the clock has expired.
 */
export function urgencyFromClock(
  secondsRemaining: number | null,
  isOvertime: boolean,
  config: ExcitementConfig = EXCITEMENT_CONFIG
): number {
  if (isOvertime) return 1;
  if (secondsRemaining === null) return 0.5; // unknown clock → neutral
  const fractionRemaining = clamp01(
    secondsRemaining / config.REGULATION_SECONDS
  );
  return clamp01(Math.pow(1 - fractionRemaining, config.URGENCY_CURVE));
}

/**
 * Volatility: total absolute win-probability movement inside the window,
 * normalised against VOLATILITY_FULL_SCALE.
 *
 * Summing |Δ| rather than taking (max - min) is deliberate: a game that
 * swings 60→40→60 has churned a lot even though its endpoints match, and
 * that churn is exactly what "it just got wild" feels like.
 */
export function volatilityFromHistory(
  samples: readonly WinProbSample[],
  now: number = Date.now(),
  config: ExcitementConfig = EXCITEMENT_CONFIG
): number {
  if (samples.length < 2) return 0;

  const cutoff = now - config.VOLATILITY_WINDOW_MS;
  const inWindow = samples.filter((s) => s.t >= cutoff);
  if (inWindow.length < 2) return 0;

  let totalSwing = 0;
  for (let i = 1; i < inWindow.length; i++) {
    totalSwing += Math.abs(
      inWindow[i].homeWinProbability - inWindow[i - 1].homeWinProbability
    );
  }
  return clamp01(totalSwing / config.VOLATILITY_FULL_SCALE);
}

// ── Situational bonuses ─────────────────────────────────────────────────────

interface SituationAssessment {
  bonus: number;
  reasons: string[];
}

/**
 * Flat point bonuses for the moments that make people run to the TV.
 * Returns both the points and the human-readable tags behind them.
 */
function assessSituation(
  game: LiveGame,
  config: ExcitementConfig
): SituationAssessment {
  const reasons: string[] = [];
  let bonus = 0;

  if (game.isOvertime) {
    bonus += config.BONUS_OVERTIME;
    reasons.push("OVERTIME");
  }

  const situation = game.situation;
  const secondsRemaining = game.secondsRemaining;

  // Two-minute territory in the second half only — a two-minute drill before
  // halftime is fun but it is not "get over there" material.
  if (
    !game.isOvertime &&
    secondsRemaining !== null &&
    secondsRemaining <= config.TWO_MINUTE_SECONDS &&
    secondsRemaining > 0
  ) {
    bonus += config.BONUS_TWO_MINUTE;
    reasons.push("Under 2:00");
  }

  if (situation) {
    const isFourthDown = situation.down === 4;
    const nearGoal =
      situation.yardsToGoal !== null &&
      situation.yardsToGoal <= config.GOAL_LINE_YARDS;

    // A goal-line stand supersedes the plain 4th-down bonus rather than
    // stacking with it — otherwise 4th & goal would double-count.
    if (isFourthDown && nearGoal) {
      bonus += config.BONUS_GOAL_LINE_STAND;
      reasons.push("Goal-line stand");
    } else if (isFourthDown) {
      bonus += config.BONUS_FOURTH_DOWN;
      reasons.push(
        situation.distance !== null ? `4th & ${situation.distance}` : "4th down"
      );
    }

    if (situation.isRedZone) {
      bonus += config.BONUS_RED_ZONE;
      reasons.push("Red zone");
    }

    if (isOnsideKick(situation.lastPlayText, situation.lastPlayType)) {
      bonus += config.BONUS_ONSIDE_KICK;
      reasons.push("Onside kick");
    }

    // Is the team with the ball the one that is losing? That is a comeback
    // drive in progress, which is more compelling than the leader running out
    // the clock.
    const possessionId = situation.possessionTeamId;
    if (possessionId) {
      const homeHasBall = possessionId === game.home.id;
      const awayHasBall = possessionId === game.away.id;
      const margin = game.home.score - game.away.score;
      const trailingHasBall =
        (homeHasBall && margin < 0) || (awayHasBall && margin > 0);
      const deficit = Math.abs(margin);
      // Only a reachable deficit counts. Trailing by 35 with the ball is not
      // a comeback drive, it is garbage time.
      if (
        trailingHasBall &&
        deficit > 0 &&
        deficit <= config.COMEBACK_MAX_DEFICIT
      ) {
        bonus += config.BONUS_COMEBACK_DRIVE;
        reasons.push(`Trailing by ${deficit} with the ball`);
      }
    }
  }

  return { bonus: Math.min(bonus, config.MAX_SITUATION_BONUS), reasons };
}

/**
 * Onside kicks are not flagged by ESPN, so sniff the play description.
 * Cheap and occasionally wrong, but a false positive costs 10 points on a
 * kickoff — acceptable for how much a real onside kick matters.
 */
function isOnsideKick(
  lastPlayText: string | null,
  lastPlayType: string | null
): boolean {
  const haystack = `${lastPlayType ?? ""} ${lastPlayText ?? ""}`.toLowerCase();
  return haystack.includes("onside");
}

// ── The main entry point ────────────────────────────────────────────────────

/**
 * Compute the excitement score for one game.
 *
 * @param game     Current normalised snapshot.
 * @param history  Recent win-probability samples for this game, oldest first.
 *                 Pass an empty array if none — volatility simply reads 0.
 * @param now      Injectable clock, so replays and tests are deterministic.
 */
export function computeExcitement(
  game: LiveGame,
  history: readonly WinProbSample[] = [],
  now: number = Date.now(),
  config: ExcitementConfig = EXCITEMENT_CONFIG
): ExcitementResult {
  // Games that are not in progress are never exciting to switch to.
  if (game.state !== "in") {
    return {
      score: 0,
      closeness: 0,
      volatility: 0,
      urgency: 0,
      timeWeight: 0,
      situationBonus: 0,
      reasons: [],
      headline: game.state === "post" ? "Final" : "Not started",
      usedFallbackCloseness: false,
    };
  }

  const timeFraction =
    game.secondsRemaining === null
      ? 0.5
      : clamp01(game.secondsRemaining / config.REGULATION_SECONDS);

  // ── closeness ────────────────────────────────────────────────────────────
  let closeness: number;
  let usedFallbackCloseness = false;
  if (game.homeWinProbability !== null) {
    closeness = closenessFromWinProb(game.homeWinProbability);
  } else {
    usedFallbackCloseness = true;
    closeness = closenessFromMargin(
      game.home.score - game.away.score,
      timeFraction,
      config
    );
  }

  // ── volatility ───────────────────────────────────────────────────────────
  const volatility = volatilityFromHistory(history, now, config);

  // ── urgency & time weighting ─────────────────────────────────────────────
  const urgency = urgencyFromClock(
    game.secondsRemaining,
    game.isOvertime,
    config
  );
  // Rescale urgency into TIME_FLOOR..1 and apply it to closeness only.
  // Multiplying closeness (rather than the whole score) is what keeps a late
  // blowout near zero while still letting a late nail-biter run away with it.
  const timeWeight =
    config.TIME_FLOOR + (1 - config.TIME_FLOOR) * urgency;

  // ── combine ──────────────────────────────────────────────────────────────
  const tension =
    config.W_CLOSENESS * closeness * timeWeight +
    config.W_VOLATILITY * volatility;
  const { bonus: situationBonus, reasons } = assessSituation(game, config);

  // Halftime / delay / between quarters: there is nothing on screen to watch.
  const stoppedMultiplier = game.isStopped
    ? config.STOPPED_PLAY_MULTIPLIER
    : 1;

  const score = clamp(
    (100 * tension + situationBonus) * stoppedMultiplier,
    0,
    100
  );

  return {
    score: Math.round(score),
    closeness,
    volatility,
    urgency,
    timeWeight,
    situationBonus,
    reasons,
    headline: buildHeadline(game, reasons, closeness, volatility),
    usedFallbackCloseness,
  };
}

/**
 * Build the "why it's exciting" line, e.g.
 *   "4th & goal, down 3, 0:42 left"
 *
 * Ordered most-specific-first so the truncated card text stays informative.
 */
function buildHeadline(
  game: LiveGame,
  reasons: string[],
  closeness: number,
  volatility: number
): string {
  const parts: string[] = [];

  // Lead with the situational tags, which are the most concrete.
  parts.push(...reasons.filter((r) => r !== "OVERTIME"));

  const margin = Math.abs(game.home.score - game.away.score);
  if (margin === 0) {
    parts.push("Tied");
  } else if (margin <= 8 && parts.length < 3) {
    // One-possession game — worth saying explicitly.
    parts.push(`${margin}-point game`);
  }

  if (volatility > 0.5) parts.push("Wild swings");
  else if (closeness > 0.85 && parts.length === 0) parts.push("Coin flip");

  // A stopped game leads with why nothing is happening.
  if (game.isStopped) {
    parts.unshift(game.statusDetail ?? "Stopped");
  }

  // Clock last, since it reads naturally as a trailing qualifier.
  if (game.isOvertime) {
    parts.unshift("OVERTIME");
  } else if (game.displayClock && game.period) {
    parts.push(`${game.displayClock} left in Q${game.period}`);
  }

  if (parts.length === 0) return game.statusDetail ?? "In progress";
  return parts.slice(0, 4).join(", ");
}

/**
 * Convenience: turn a scored game into a timeline point for the history log.
 */
export function toTimelinePoint(
  game: LiveGame,
  result: ExcitementResult,
  t: number = Date.now()
): TimelinePoint {
  return {
    t,
    homeWinProbability: game.homeWinProbability,
    excitement: result.score,
    secondsRemaining: game.secondsRemaining,
    homeScore: game.home.score,
    awayScore: game.away.score,
  };
}

// ── Small numeric helpers ───────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function clamp01(n: number): number {
  return clamp(n, 0, 1);
}
