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

import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedGame } from "@/lib/football/types";

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

export function useGameday() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  // Alerts already surfaced as a browser notification, so a reconnect (which
  // resends the whole recentAlerts list) doesn't re-notify for old events.
  const notifiedRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  const handleSnapshot = useCallback((next: Snapshot) => {
    setSnapshot(next);

    const seen = notifiedRef.current;
    // On the very first snapshot, mark everything as already-seen: alerts that
    // fired before the page opened are history, not news.
    if (!seededRef.current) {
      seededRef.current = true;
      for (const alert of next.recentAlerts ?? []) {
        seen.add(alertKey(alert));
      }
      return;
    }

    for (const alert of next.recentAlerts ?? []) {
      const key = alertKey(alert);
      if (seen.has(key)) continue;
      seen.add(key);
      raiseBrowserNotification(alert);
    }
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

  /** Persist a settings change and optimistically reflect it in the UI. */
  const saveSettings = useCallback(async (patch: Partial<AlertSettings>) => {
    setSnapshot((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev
    );
    try {
      const res = await fetch("/api/gameday/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const settings = (await res.json()) as AlertSettings;
      setSnapshot((prev) => (prev ? { ...prev, settings } : prev));
    } catch {
      // Offline — the optimistic value stands until the next snapshot.
    }
  }, []);

  return { snapshot, connection, saveSettings };
}

function alertKey(alert: FiredAlert): string {
  return `${alert.gameId}:${alert.firedAt}`;
}

function raiseBrowserNotification(alert: FiredAlert): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(`🏈 ${alert.label} · ${alert.score}`, {
      body: alert.headline,
      tag: alert.gameId, // Replaces an earlier alert for the same game.
    });
  } catch {
    // Some browsers forbid constructing Notification outside a SW context.
  }
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
