"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The dashboard's live data hook.
//
// Primary transport is SSE (/api/gameday/stream). If the stream errors — a
// proxy that buffers, a phone that suspended the tab, a dev-server restart —
// it falls back to plain polling so the board never silently goes stale.
//
// Also owns browser notifications: the server pushes the full snapshot
// including `recentAlerts`, and this hook raises a Notification for any alert
// it has not already shown. That keeps the browser channel working even when
// no ntfy topic is configured.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeagueId, RankedGame, TeamRef } from "@/lib/football/types";
import { fandomKey, personalizeScore } from "@/lib/football/excitement";
import type { ViewerPrefs } from "./useViewerPrefs";

export interface FiredAlert {
  gameId: string;
  label: string;
  score: number;
  headline: string;
  firedAt: number;
  channels: string[];
}

export interface AlertSettings {
  threshold: number;
  cooldownMs: number;
  ntfyTopic: string;
  leagues: LeagueId[];
  favorites: TeamRef[];
  rivals: TeamRef[];
}

export interface Snapshot {
  games: RankedGame[];
  settings: AlertSettings;
  recentAlerts: FiredAlert[];
  lastPollAt: number | null;
  lastPollError: string | null;
  provider: string;
  serverTime: number;
}

export type ConnectionState = "connecting" | "live" | "polling" | "error";

/** Fallback poll cadence used only when SSE is unavailable. */
const FALLBACK_POLL_MS = 20_000;

/**
 * Re-score and re-rank a server snapshot using THIS browser's team picks.
 *
 * The server ranks with its own settings; every viewer re-ranks locally so a
 * shared URL doesn't mean shared preferences.
 */
export function usePersonalizedGames(
  snapshot: Snapshot | null,
  prefs: ViewerPrefs
): RankedGame[] {
  return useMemo(() => {
    if (!snapshot) return [];

    const fandom = {
      favorites: new Set(prefs.favorites.map((t) => fandomKey(t.league, t.id))),
      rivals: new Set(prefs.rivals.map((t) => fandomKey(t.league, t.id))),
    };
    const leagues = new Set(prefs.leagues);

    return snapshot.games
      .filter((entry) => leagues.has(entry.game.league))
      .map((entry) => ({
        ...entry,
        excitement: personalizeScore(entry.game, entry.excitement, fandom),
      }))
      // Same ordering rule as the server: live games first, then by score.
      .sort((a, b) => {
        const aLive = a.game.state === "in" ? 1 : 0;
        const bLive = b.game.state === "in" ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        return b.excitement.score - a.excitement.score;
      });
  }, [snapshot, prefs.favorites, prefs.rivals, prefs.leagues]);
}

export function useGameday() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  // Browser notifications are raised by the Dashboard from THIS viewer's
  // personalized scores (see useLocalAlerts), not from the server's
  // recentAlerts — the server alerts on the deployment owner's teams, which
  // are not necessarily this viewer's.
  const handleSnapshot = useCallback((next: Snapshot) => {
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/gameday", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Snapshot;
        if (cancelled) return;
        handleSnapshot(data);
        setConnection((c) => (c === "live" ? c : "polling"));
      } catch {
        if (!cancelled) setConnection("error");
      }
    };

    const startFallbackPolling = () => {
      if (pollTimer || cancelled) return;
      void poll();
      pollTimer = setInterval(() => void poll(), FALLBACK_POLL_MS);
    };

    try {
      source = new EventSource("/api/gameday/stream");

      source.onmessage = (event) => {
        if (cancelled) return;
        try {
          handleSnapshot(JSON.parse(event.data) as Snapshot);
          setConnection("live");
          // The stream is healthy — stand the fallback poller down.
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        } catch {
          // A malformed frame is not fatal; wait for the next one.
        }
      };

      source.onerror = () => {
        if (cancelled) return;
        // EventSource retries on its own, but if it is failing we still want
        // fresh data, so run the poller alongside it.
        setConnection((c) => (c === "live" ? "polling" : c));
        startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }

    return () => {
      cancelled = true;
      source?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [handleSnapshot]);

  /**
   * Pull a fresh snapshot on demand. Real-time dashboards need a manual
   * refresh: when a number looks stale, people want to confirm it rather than
   * wonder whether the stream died.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/gameday", { cache: "no-store" });
      if (!res.ok) return;
      setSnapshot((await res.json()) as Snapshot);
    } catch {
      // Leave the last good snapshot on screen rather than blanking the board.
    }
  }, []);

  return { snapshot, connection, refresh };
}

/** Ask for notification permission; returns the resulting permission state. */
export async function requestNotificationPermission(): Promise<string> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
