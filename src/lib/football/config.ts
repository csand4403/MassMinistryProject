// ─────────────────────────────────────────────────────────────────────────────
// Runtime configuration for the Get Over There Now engine.
// Everything here is env-overridable so the tool can be tuned without edits.
// ─────────────────────────────────────────────────────────────────────────────

import type { LeagueId } from "./types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const RUNTIME_CONFIG = {
  /**
   * Poll interval while at least one game is live. The spec asks for 15-30s;
   * 20s keeps ESPN happy while still catching a two-minute drill play by play.
   */
  livePollMs: envInt("FOOTBALL_POLL_MS", 20_000),

  /**
   * Poll interval when nothing is live. No reason to hammer the API at 3am —
   * this only needs to notice that a game has kicked off.
   */
  idlePollMs: envInt("FOOTBALL_IDLE_POLL_MS", 300_000),

  /** How many win-probability samples to retain per game (~1 hour at 20s). */
  maxHistorySamples: envInt("FOOTBALL_MAX_HISTORY", 180),

  /**
   * Leagues tracked on a cold start, before the user has saved any settings.
   *
   * College football is the default: this tool is built around Saturdays,
   * where 60+ simultaneous games make "which one do I watch" an actual
   * problem. The NFL is fully supported and can be switched on from the
   * dashboard or with FOOTBALL_LEAGUES=nfl,college-football.
   */
  defaultLeagues: parseLeagues(process.env.FOOTBALL_LEAGUES),
} as const;

export const ALL_LEAGUES: LeagueId[] = ["nfl", "college-football"];

export function parseLeagues(raw: string | undefined): LeagueId[] {
  if (!raw) return ["college-football"];
  const requested = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as LeagueId[];
  const filtered = requested.filter((l) => ALL_LEAGUES.includes(l));
  return filtered.length > 0 ? filtered : ["college-football"];
}

/** Alerting defaults — the user can change these live from the dashboard. */
export const ALERT_DEFAULTS = {
  /** Fire an alert when a game's excitement crosses this. */
  threshold: envInt("FOOTBALL_ALERT_THRESHOLD", 80),

  /**
   * Once a game has alerted, stay quiet about it for this long even if it
   * remains above the threshold. This is the primary anti-spam guard: a game
   * that sits at 95 for a whole quarter should notify once, not 45 times.
   */
  cooldownMs: envInt("FOOTBALL_ALERT_COOLDOWN_MS", 10 * 60 * 1000),

  /**
   * After a game drops this far below the threshold, it is considered "reset"
   * and may alert again immediately once it climbs back. Prevents a game
   * hovering at the threshold from re-firing on every jitter.
   */
  rearmMargin: envInt("FOOTBALL_ALERT_REARM_MARGIN", 10),

  /** ntfy.sh topic to publish to. Empty disables server-side push. */
  ntfyTopic: process.env.NTFY_TOPIC ?? "",
  ntfyServer: process.env.NTFY_SERVER ?? "https://ntfy.sh",
} as const;
