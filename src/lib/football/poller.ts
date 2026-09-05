// ─────────────────────────────────────────────────────────────────────────────
// The poll loop: fetch -> score -> rank -> record -> alert -> broadcast.
//
// Self-scheduling with setTimeout rather than setInterval, so a slow ESPN
// response can never cause overlapping polls to pile up.
//
// The interval adapts: RUNTIME_CONFIG.livePollMs while games are in progress,
// idlePollMs otherwise.
// ─────────────────────────────────────────────────────────────────────────────

import { getProvider } from "./providers";
import { RUNTIME_CONFIG } from "./config";
import { computeExcitement, toTimelinePoint } from "./excitement";
import type { LiveGame, RankedGame } from "./types";
import {
  broadcast,
  engine,
  getRecentAlerts,
  getSettings,
  getTimeline,
  getWinProbHistory,
  recordFiredAlert,
  recordTimeline,
  recordWinProb,
  setLabel,
  setRanked,
  shouldAlert,
  type Snapshot,
} from "./store";
import { buildAlert, dispatch } from "./notify";

/** How far back the card sparkline reaches. */
const SPARKLINE_POINTS = 30;
/** Excitement delta is measured against roughly this far back. */
const TREND_LOOKBACK_MS = 60_000;

export function isRunning(): boolean {
  return engine().running;
}

/** Start the loop if it is not already going. Safe to call repeatedly. */
export function startPolling(): void {
  const state = engine();
  if (state.running) return;
  state.running = true;
  void tick();
}

export function stopPolling(): void {
  const state = engine();
  state.running = false;
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
}

/** Run one poll immediately and return the resulting snapshot. */
export async function pollOnce(): Promise<Snapshot> {
  const state = engine();
  const provider = getProvider();

  try {
    const games = await provider.fetchScoreboard(RUNTIME_CONFIG.leagues);
    const ranked = scoreAndRank(games);
    setRanked(ranked);
    state.lastPollAt = Date.now();
    state.lastPollError = null;

    // Alerting runs after ranking so it sees the same numbers the UI shows.
    await fireAlerts(ranked);
  } catch (err) {
    state.lastPollError = err instanceof Error ? err.message : String(err);
    console.error("[gameday] poll failed:", err);
  }

  const snapshot = buildSnapshot();
  broadcast(snapshot);
  return snapshot;
}

async function tick(): Promise<void> {
  const state = engine();
  if (!state.running) return;

  await pollOnce();

  if (!state.running) return;
  const hasLive = state.ranked.some((r) => r.game.state === "in");
  const delay = hasLive ? RUNTIME_CONFIG.livePollMs : RUNTIME_CONFIG.idlePollMs;
  state.pollTimer = setTimeout(() => void tick(), delay);
}

// ── Scoring & ranking ───────────────────────────────────────────────────────

function scoreAndRank(games: LiveGame[]): RankedGame[] {
  const now = Date.now();
  const ranked: RankedGame[] = [];

  for (const game of games) {
    setLabel(game.id, `${game.away.abbreviation} @ ${game.home.abbreviation}`);

    // Record the new win-prob sample BEFORE scoring, so the volatility term
    // includes the swing that just happened rather than lagging a poll behind.
    recordWinProb(game.id, game);
    const history = getWinProbHistory(game.id);
    const excitement = computeExcitement(game, history, now);

    if (game.state === "in") {
      recordTimeline(game.id, toTimelinePoint(game, excitement, now));
    }

    const timeline = getTimeline(game.id);
    ranked.push({
      game,
      excitement,
      sparkline: timeline.slice(-SPARKLINE_POINTS).map((p) => p.excitement),
      trend: computeTrend(timeline, now),
    });
  }

  // Live games first, then by excitement. A finished thriller must never
  // outrank a live game just because its final score was high.
  ranked.sort((a, b) => {
    const aLive = a.game.state === "in" ? 1 : 0;
    const bLive = b.game.state === "in" ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return b.excitement.score - a.excitement.score;
  });

  return ranked;
}

/** Excitement now minus excitement ~1 minute ago; positive = heating up. */
function computeTrend(
  timeline: { t: number; excitement: number }[],
  now: number
): number {
  if (timeline.length < 2) return 0;
  const current = timeline[timeline.length - 1];
  const cutoff = now - TREND_LOOKBACK_MS;
  // Walk back to the oldest point still inside the lookback window.
  let reference = timeline[0];
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].t <= cutoff) {
      reference = timeline[i];
      break;
    }
  }
  return current.excitement - reference.excitement;
}

// ── Alerting ────────────────────────────────────────────────────────────────

async function fireAlerts(ranked: RankedGame[]): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL ?? null;

  for (const entry of ranked) {
    if (entry.game.state !== "in") continue;
    if (!shouldAlert(entry.game.id, entry.excitement.score)) continue;

    const payload = buildAlert(entry, baseUrl);
    const channels = await dispatch(payload);

    recordFiredAlert({
      gameId: entry.game.id,
      label: `${entry.game.away.abbreviation} @ ${entry.game.home.abbreviation}`,
      score: entry.excitement.score,
      headline: entry.excitement.headline,
      firedAt: Date.now(),
      // "browser" is always listed: the dashboard raises a Web Notification
      // from the snapshot regardless of server-side channels.
      channels: [...channels, "browser"],
    });
  }
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export function buildSnapshot(): Snapshot {
  const state = engine();
  return {
    games: state.ranked,
    settings: getSettings(),
    recentAlerts: getRecentAlerts(),
    lastPollAt: state.lastPollAt,
    lastPollError: state.lastPollError,
    provider: getProvider().name,
    serverTime: Date.now(),
  };
}
