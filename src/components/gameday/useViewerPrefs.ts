"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Per-browser viewer preferences.
//
// WHY THESE ARE NOT SERVER-SIDE:
// the server holds one set of settings and broadcasts one snapshot to every
// connected browser. That is fine for a single-user tool, but the moment the
// dashboard URL is shared, two people picking teams would overwrite each
// other. So the things that are personal — your teams, your alert threshold —
// live in localStorage and are applied to the shared snapshot locally.
//
// The server keeps its own copy for the one thing it must do centrally: fire
// ntfy push alerts. Those follow the deployment owner's settings.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import type { LeagueId, TeamRef } from "@/lib/football/types";

const STORAGE_KEY = "gameday.viewer.v1";

export interface ViewerPrefs {
  /** Notify me (in this browser) at or above this excitement. */
  threshold: number;
  favorites: TeamRef[];
  rivals: TeamRef[];
  /** Leagues this viewer wants to see. Filtering is client-side. */
  leagues: LeagueId[];
  /** "system" follows the OS setting. */
  theme: "dark" | "light" | "system";
}

export const DEFAULT_PREFS: ViewerPrefs = {
  threshold: 80,
  favorites: [],
  rivals: [],
  leagues: ["college-football"],
  theme: "dark",
};

function readPrefs(): ViewerPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ViewerPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      // Never trust stored shapes: a half-written value must not break render.
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      rivals: Array.isArray(parsed.rivals) ? parsed.rivals : [],
      leagues:
        Array.isArray(parsed.leagues) && parsed.leagues.length > 0
          ? parsed.leagues
          : DEFAULT_PREFS.leagues,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useViewerPrefs() {
  // Start from defaults so server and first client render agree, then load
  // real values in an effect — otherwise hydration mismatches on every visit.
  const [prefs, setPrefs] = useState<ViewerPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<ViewerPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode / storage disabled: preferences last for this session.
      }
      return next;
    });
  }, []);

  return { prefs, update, loaded };
}

/** Apply the viewer's theme choice to the document element. */
export function useTheme(theme: ViewerPrefs["theme"]) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
