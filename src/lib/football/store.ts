// ─────────────────────────────────────────────────────────────────────────────
// In-memory engine state: win-probability history, excitement timelines,
// alert bookkeeping, and the subscriber list that feeds the SSE stream.
//
// State lives on `globalThis` so it survives Next.js hot-module reloading in
// development (otherwise every file save would wipe the volatility history and
// the algorithm would go blind for five minutes).
//
// SCOPE NOTE: this is deliberately a single-process, in-memory store, which
// suits the stated goal — a single-user personal tool run as one Node process.
// On a serverless platform each lambda would get its own empty copy and the
// volatility term would never warm up; see the README's Deployment section.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LiveGame,
  RankedGame,
  TimelinePoint,
  ExcitementResult,
} from "./types";
import type { WinProbSample } from "./excitement";
import { ALERT_DEFAULTS, RUNTIME_CONFIG } from "./config";

/** User-adjustable settings, changed live from the dashboard. */
export interface AlertSettings {
  threshold: number;
  cooldownMs: number;
  ntfyTopic: string;
}

/** Per-game alert bookkeeping used for debouncing. */
interface AlertState {
  /** When we last fired for this game. */
  lastFiredAt: number;
  /** True while the game is "spent" — it alerted and hasn't reset yet. */
  armed: boolean;
}

/** An alert that has fired, kept so the UI can show recent activity. */
export interface FiredAlert {
  gameId: string;
  label: string;
  score: number;
  headline: string;
  firedAt: number;
  /** Which channels actually accepted the alert. */
  channels: string[];
}

interface EngineState {
  /** Latest ranked snapshot served to clients. */
  ranked: RankedGame[];
  /** gameId -> win-probability samples (oldest first). */
  winProbHistory: Map<string, WinProbSample[]>;
  /** gameId -> excitement timeline (oldest first). */
  timelines: Map<string, TimelinePoint[]>;
  /** gameId -> display label, retained after a game leaves the slate. */
  labels: Map<string, string>;
  /** gameId -> debounce state. */
  alertState: Map<string, AlertState>;
  /** Most recent alerts, newest first. */
  recentAlerts: FiredAlert[];
  settings: AlertSettings;
  subscribers: Set<(payload: string) => void>;
  lastPollAt: number | null;
  lastPollError: string | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  running: boolean;
}

// `var` + globalThis is the standard Next.js singleton escape hatch.
declare global {
  // eslint-disable-next-line no-var
  var __gamedayEngine: EngineState | undefined;
}

function createState(): EngineState {
  return {
    ranked: [],
    winProbHistory: new Map(),
    timelines: new Map(),
    labels: new Map(),
    alertState: new Map(),
    recentAlerts: [],
    settings: {
      threshold: ALERT_DEFAULTS.threshold,
      cooldownMs: ALERT_DEFAULTS.cooldownMs,
      ntfyTopic: ALERT_DEFAULTS.ntfyTopic,
    },
    subscribers: new Set(),
    lastPollAt: null,
    lastPollError: null,
    pollTimer: null,
    running: false,
  };
}

export function engine(): EngineState {
  if (!globalThis.__gamedayEngine) {
    globalThis.__gamedayEngine = createState();
  }
  return globalThis.__gamedayEngine;
}

// ── History ─────────────────────────────────────────────────────────────────

/**
 * Record a win-probability observation, if the provider gave us one.
 *
 * Consecutive identical values are still recorded: the volatility window is
 * time-based, so keeping the samples lets an old swing correctly age out.
 */
export function recordWinProb(gameId: string, game: LiveGame): void {
  if (game.homeWinProbability === null) return;
  const state = engine();
  const list = state.winProbHistory.get(gameId) ?? [];
  list.push({ t: game.fetchedAt, homeWinProbability: game.homeWinProbability });
  // Ring-buffer: drop the oldest samples beyond the retention limit.
  if (list.length > RUNTIME_CONFIG.maxHistorySamples) {
    list.splice(0, list.length - RUNTIME_CONFIG.maxHistorySamples);
  }
  state.winProbHistory.set(gameId, list);
}

export function getWinProbHistory(gameId: string): WinProbSample[] {
  return engine().winProbHistory.get(gameId) ?? [];
}

/** Append to the excitement timeline used by the history/verification view. */
export function recordTimeline(gameId: string, point: TimelinePoint): void {
  const state = engine();
  const list = state.timelines.get(gameId) ?? [];
  list.push(point);
  if (list.length > RUNTIME_CONFIG.maxHistorySamples * 4) {
    list.splice(0, list.length - RUNTIME_CONFIG.maxHistorySamples * 4);
  }
  state.timelines.set(gameId, list);
}

export function getTimeline(gameId: string): TimelinePoint[] {
  return engine().timelines.get(gameId) ?? [];
}

export function getAllTimelines(): Record<string, TimelinePoint[]> {
  const out: Record<string, TimelinePoint[]> = {};
  engine().timelines.forEach((points, id) => {
    out[id] = points;
  });
  return out;
}

export function getLabel(gameId: string): string {
  return engine().labels.get(gameId) ?? gameId;
}

export function setLabel(gameId: string, label: string): void {
  engine().labels.set(gameId, label);
}

// ── Settings ────────────────────────────────────────────────────────────────

export function getSettings(): AlertSettings {
  return engine().settings;
}

export function updateSettings(patch: Partial<AlertSettings>): AlertSettings {
  const state = engine();
  state.settings = { ...state.settings, ...patch };
  return state.settings;
}

// ── Alert debouncing ────────────────────────────────────────────────────────

/**
 * Decide whether a game crossing the threshold should actually notify.
 *
 * Two guards, both needed:
 *   • cooldown  — never re-alert the same game within cooldownMs.
 *   • re-arming — after alerting, the game must fall `rearmMargin` points
 *                 BELOW the threshold before it becomes eligible again.
 *
 * Without re-arming, a game oscillating between 79 and 81 would fire on every
 * poll once the cooldown lapsed. Without the cooldown, a game that climbs and
 * stays hot would fire repeatedly during a single dramatic drive.
 */
export function shouldAlert(
  gameId: string,
  score: number,
  now: number = Date.now()
): boolean {
  const state = engine();
  const { threshold, cooldownMs } = state.settings;
  const existing = state.alertState.get(gameId);

  if (score < threshold) {
    // Re-arm once the game has cooled meaningfully below the threshold.
    if (existing && score <= threshold - ALERT_DEFAULTS.rearmMargin) {
      existing.armed = true;
    }
    return false;
  }

  if (!existing) {
    state.alertState.set(gameId, { lastFiredAt: now, armed: false });
    return true;
  }

  if (!existing.armed) return false;
  if (now - existing.lastFiredAt < cooldownMs) return false;

  existing.lastFiredAt = now;
  existing.armed = false;
  return true;
}

export function recordFiredAlert(alert: FiredAlert): void {
  const state = engine();
  state.recentAlerts.unshift(alert);
  if (state.recentAlerts.length > 50) state.recentAlerts.length = 50;
}

export function getRecentAlerts(): FiredAlert[] {
  return engine().recentAlerts;
}

// ── Snapshot + pub/sub for the SSE stream ───────────────────────────────────

export interface Snapshot {
  games: RankedGame[];
  settings: AlertSettings;
  recentAlerts: FiredAlert[];
  lastPollAt: number | null;
  lastPollError: string | null;
  provider: string;
  serverTime: number;
}

export function setRanked(ranked: RankedGame[]): void {
  engine().ranked = ranked;
}

export function getRanked(): RankedGame[] {
  return engine().ranked;
}

export function subscribe(fn: (payload: string) => void): () => void {
  const state = engine();
  state.subscribers.add(fn);
  return () => {
    state.subscribers.delete(fn);
  };
}

/** Push a serialised snapshot to every connected dashboard. */
export function broadcast(snapshot: Snapshot): void {
  const payload = JSON.stringify(snapshot);
  engine().subscribers.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // A dead connection must never break the poll loop; the stream's own
      // cancel handler will unsubscribe it.
    }
  });
}

export type { ExcitementResult, RankedGame };
