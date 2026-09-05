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
//   fandomBonus Personal-interest adjustment, zero unless you have configured
//               teams. Two halves, deliberately asymmetric:
//
//                 • FAVORITE — a FLAT interest premium. Your team is worth a
//                   fixed number of extra points to you, always. That is
//                   enough to win a dull slate (everything sits near 25, so
//                   your team lands near 50) while never beating somebody
//                   else's 4th-quarter thriller at 85.
//
//                   It is deliberately flat rather than scaled by
//                   (1 - objectiveScore): an inverse scale pays the BIGGEST
//                   bonus to the least watchable game, which put a favorite
//                   being blown out 28-0 above a neutral 3-point game in
//                   testing. A flat premium leaves a blowout ranked below
//                   competitive games, which is where it belongs.
//
//                   The one taper: once a game is DECIDED and LATE, the
//                   premium shrinks (FAVORITE_DECIDED_TAPER). Being down 35
//                   in the 3rd is not appointment viewing even for a diehard,
//                   while being down 35 in the 1st still might turn around,
//                   which is why the taper is gated on urgency rather than on
//                   the margin alone.
//
//                 • HATE WATCH — scales with how much TROUBLE the rival is in
//                   (1 - their win probability), sharpened by a curve and
//                   weighted by urgency, plus a flat kicker when a ranked
//                   rival is losing to a much lower-ranked opponent. Rooting
//                   against a team is not the mirror image of rooting for one:
//                   you want your team's games, but you only want your
//                   rival's games when they are going badly.
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
   * Flat points added for a game featuring one of your teams.
   *
   * 25 is calibrated so your team wins a boring slate (typical early-game
   * scores sit in the 20s) but still loses to a genuine late thriller
   * elsewhere (80+). Raise it if your team's games should always win the
   * board; lower it if you want the algorithm to overrule your heart.
   */
  FAVORITE_INTEREST: 25,
  /**
   * How much of the favorite premium a decided, late game gives up.
   * 0 disables the taper (your team is always worth the full premium);
   * 1 strips it entirely once the result is certain.
   */
  FAVORITE_DECIDED_TAPER: 0.7,

  /** Peak points for a rival in maximum trouble, late. */
  HATE_WATCH_MAX: 30,
  /**
   * Exponent on rival trouble. Above 1 means the bonus stays modest while the
   * rival is merely behind and ramps hard as they approach actual defeat.
   */
  HATE_CURVE: 1.6,
  /**
   * Share of the hate-watch bonus available in the 1st quarter. The rest is
   * unlocked by urgency — a rival losing early might still be a blip, a rival
   * losing late is the event you tuned in for.
   */
  HATE_TIME_FLOOR: 0.4,
  /** Flat bonus when a ranked rival is losing to a far lower-ranked team. */
  HATE_UPSET_BONUS: 12,
  /**
   * How many poll positions worse the opponent must be for it to read as an
   * upset. An unranked opponent always qualifies.
   */
  UPSET_RANK_GAP: 10,

  /**
   * Logistic steepness for the margin-based stand-in win probability used
   * when the provider exposes none. Tuned so a one-score lead at halftime
   * reads around 0.8.
   */
  FALLBACK_WP_STEEPNESS: 0.16,

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
        // Name the team: "Trailing by 9 with the ball" next to a card where
        // the OTHER side is winning reads as though the leader is behind.
        const trailing = homeHasBall ? game.home : game.away;
        reasons.push(`${trailing.abbreviation} trailing by ${deficit}, has ball`);
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

// ── Fandom: favorite teams and hate watches ────────────────────────────────

/**
 * The user's team preferences, resolved to lookup keys.
 *
 * Keys are `"<league>:<teamId>"` because team ids are only unique within a
 * league — ESPN's college id "2" is Auburn while NFL id "2" is Buffalo, and
 * matching on the bare id would light up the wrong games.
 */
export interface FandomContext {
  favorites: ReadonlySet<string>;
  rivals: ReadonlySet<string>;
}

export const NO_FANDOM: FandomContext = {
  favorites: new Set(),
  rivals: new Set(),
};

/** Build the lookup key for one team in one league. */
export function fandomKey(league: string, teamId: string): string {
  return `${league}:${teamId}`;
}

/**
 * A crude stand-in for win probability when the provider offers none, derived
 * from score margin and how much time is left. Logistic in the margin, with
 * the margin's weight growing as the clock runs down.
 *
 * This exists only so hate-watch scoring still works on the small-conference
 * games that carry no win probability; it is not meant to be a good model.
 */
export function pseudoWinProbFromMargin(
  margin: number,
  timeFraction: number,
  config: ExcitementConfig = EXCITEMENT_CONFIG
): number {
  const timePressure = 1 + 1.5 * (1 - clamp01(timeFraction));
  const x = config.FALLBACK_WP_STEEPNESS * margin * timePressure;
  return 1 / (1 + Math.exp(-x));
}

interface FandomAssessment {
  favorite: "home" | "away" | null;
  rival: "home" | "away" | null;
  bonus: number;
  reasons: string[];
}

/**
 * Personal-interest scoring. See the formula header for the reasoning behind
 * the asymmetry between favorites and rivals.
 *
 */
function assessFandom(
  game: LiveGame,
  fandom: FandomContext,
  urgency: number,
  timeFraction: number,
  config: ExcitementConfig
): FandomAssessment {
  const homeKey = fandomKey(game.league, game.home.id);
  const awayKey = fandomKey(game.league, game.away.id);

  const favorite: "home" | "away" | null = fandom.favorites.has(homeKey)
    ? "home"
    : fandom.favorites.has(awayKey)
      ? "away"
      : null;
  const rival: "home" | "away" | null = fandom.rivals.has(homeKey)
    ? "home"
    : fandom.rivals.has(awayKey)
      ? "away"
      : null;

  const reasons: string[] = [];
  let bonus = 0;

  // ── Favorite ────────────────────────────────────────────────────────────
  if (favorite) {
    const team = favorite === "home" ? game.home : game.away;
    // How settled is the result? 0 = coin flip, 1 = decided.
    const winProb =
      game.homeWinProbability ??
      pseudoWinProbFromMargin(
        game.home.score - game.away.score,
        timeFraction,
        config
      );
    const decidedness = clamp01(Math.abs(winProb - 0.5) * 2);

    // Flat premium (see the formula header), given up only as a decided game
    // runs out of clock.
    const taper = 1 - config.FAVORITE_DECIDED_TAPER * decidedness * urgency;
    bonus += config.FAVORITE_INTEREST * clamp01(taper);

    reasons.push(`${team.abbreviation} — your team`);
  }

  // ── Hate watch ───────────────────────────────────────────────────────────
  if (rival) {
    const rivalTeam = rival === "home" ? game.home : game.away;
    const otherTeam = rival === "home" ? game.away : game.home;

    // How likely is the rival to LOSE right now?
    let rivalWinProb: number;
    if (game.homeWinProbability !== null) {
      rivalWinProb =
        rival === "home"
          ? game.homeWinProbability
          : 1 - game.homeWinProbability;
    } else {
      rivalWinProb = pseudoWinProbFromMargin(
        rivalTeam.score - otherTeam.score,
        timeFraction,
        config
      );
    }

    const trouble = clamp01(1 - rivalWinProb);
    const timeShare =
      config.HATE_TIME_FLOOR + (1 - config.HATE_TIME_FLOOR) * urgency;
    const hate =
      config.HATE_WATCH_MAX * Math.pow(trouble, config.HATE_CURVE) * timeShare;
    bonus += hate;

    const losing = rivalTeam.score < otherTeam.score;

    // An upset needs the rival to be the one with something to lose.
    const isUpsetShape =
      rivalTeam.rank !== null &&
      (otherTeam.rank === null ||
        otherTeam.rank - rivalTeam.rank >= config.UPSET_RANK_GAP);

    if (isUpsetShape && losing) {
      bonus += config.HATE_UPSET_BONUS;
      reasons.push(
        `UPSET ALERT: #${rivalTeam.rank} ${rivalTeam.abbreviation} losing to ${otherTeam.abbreviation}`
      );
    } else if (trouble > 0.55) {
      reasons.push(
        losing
          ? `${rivalTeam.abbreviation} losing — hate watch`
          : `${rivalTeam.abbreviation} in trouble — hate watch`
      );
    } else if (favorite === null) {
      // Still worth labelling why this game is on your board at all.
      reasons.push(`${rivalTeam.abbreviation} — hate watch`);
    }
  }

  return { favorite, rival, bonus, reasons };
}

// ── The main entry point ────────────────────────────────────────────────────

/**
 * Compute the excitement score for one game.
 *
 * @param game     Current normalised snapshot.
 * @param history  Recent win-probability samples for this game, oldest first.
 *                 Pass an empty array if none — volatility simply reads 0.
 * @param now      Injectable clock, so replays and tests are deterministic.
 * @param fandom   The user's favorite / rival teams. Defaults to NO_FANDOM,
 *                 which makes this function purely objective.
 */
export function computeExcitement(
  game: LiveGame,
  history: readonly WinProbSample[] = [],
  now: number = Date.now(),
  fandom: FandomContext = NO_FANDOM,
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
      fandom: { favorite: null, rival: null, bonus: 0 },
      objectiveScore: 0,
      stoppedMultiplier: 1,
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

  // The objective score: what this game is worth to a neutral viewer. Fandom
  // is layered on top of this, and reads it, so a favorite team's bump can
  // shrink when the game is genuinely good on its own merits.
  const objectiveScore = clamp(100 * tension + situationBonus, 0, 100);

  const fandomResult = assessFandom(
    game,
    fandom,
    urgency,
    timeFraction,
    config
  );

  // Halftime / delay / between quarters: there is nothing on screen to watch,
  // and that applies to your team's game too.
  const stoppedMultiplier = game.isStopped
    ? config.STOPPED_PLAY_MULTIPLIER
    : 1;

  const score = clamp(
    (objectiveScore + fandomResult.bonus) * stoppedMultiplier,
    0,
    100
  );

  // Fandom reasons lead: "UPSET ALERT" is the thing you want to read first.
  const allReasons = [...fandomResult.reasons, ...reasons];

  return {
    score: Math.round(score),
    closeness,
    volatility,
    urgency,
    timeWeight,
    situationBonus,
    reasons: allReasons,
    headline: buildHeadline(game, allReasons, closeness, volatility),
    usedFallbackCloseness,
    fandom: {
      favorite: fandomResult.favorite,
      rival: fandomResult.rival,
      bonus: Math.round(fandomResult.bonus),
    },
    objectiveScore,
    stoppedMultiplier,
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
 * Re-apply fandom to an already-scored game using a DIFFERENT set of team
 * preferences. Pure, dependency-free, and safe to run in the browser.
 *
 * The server scores every game once with its own settings and broadcasts one
 * snapshot to everybody. Each browser then calls this with the teams saved in
 * its own localStorage, so two people watching the same shared URL each get
 * their own ranking without one overwriting the other's picks.
 */
export function personalizeScore(
  game: LiveGame,
  result: ExcitementResult,
  fandom: FandomContext,
  config: ExcitementConfig = EXCITEMENT_CONFIG
): ExcitementResult {
  if (game.state !== "in") return result;

  const timeFraction =
    game.secondsRemaining === null
      ? 0.5
      : clamp01(game.secondsRemaining / config.REGULATION_SECONDS);

  const assessed = assessFandom(
    game,
    fandom,
    result.urgency,
    timeFraction,
    config
  );

  const score = clamp(
    (result.objectiveScore + assessed.bonus) * result.stoppedMultiplier,
    0,
    100
  );

  // Strip the server's fandom reasons before adding this viewer's, otherwise
  // someone else's "your team" tag would leak onto this browser's cards.
  const objectiveReasons = result.reasons.filter(
    (r) => !isFandomReason(r)
  );
  const reasons = [...assessed.reasons, ...objectiveReasons];

  return {
    ...result,
    score: Math.round(score),
    reasons,
    headline: buildHeadline(game, reasons, result.closeness, result.volatility),
    fandom: {
      favorite: assessed.favorite,
      rival: assessed.rival,
      bonus: Math.round(assessed.bonus),
    },
  };
}

/** Tags produced by assessFandom, which are viewer-specific. */
function isFandomReason(reason: string): boolean {
  return (
    reason.includes("your team") ||
    reason.startsWith("UPSET ALERT") ||
    reason.includes("hate watch")
  );
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
