"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Settings, as a bottom sheet.
//
// A sheet rather than an inline accordion: on a phone the accordion pushed the
// board down and you lost your place. A sheet keeps the board where it was and
// is the pattern people already expect from mobile apps.
//
// Everything here is per-browser (localStorage). The one exception is the ntfy
// topic, which is server-side because the server sends those pushes — it is
// shown only when this deployment is the viewer's own.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { TeamPicker } from "./TeamPicker";
import type { ViewerPrefs } from "./useViewerPrefs";
import { requestNotificationPermission } from "./useGameday";
import type { LeagueId } from "@/lib/football/types";

const LEAGUE_LABELS: Record<LeagueId, string> = {
  "college-football": "College",
  nfl: "NFL",
};

const THEMES: { value: ViewerPrefs["theme"]; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
];

export function SettingsSheet({
  open,
  onClose,
  prefs,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  prefs: ViewerPrefs;
  onChange: (patch: Partial<ViewerPrefs>) => void;
}) {
  const [permission, setPermission] = useState<string | null>(null);

  // Escape closes; body scroll locks so the board behind doesn't move.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleLeague = (league: LeagueId) => {
    const on = prefs.leagues.includes(league);
    const next = on
      ? prefs.leagues.filter((l) => l !== league)
      : [...prefs.leagues, league];
    if (next.length === 0) return; // never leave the board with no leagues
    onChange({ leagues: next });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close settings"
        tabIndex={-1}
      />

      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        {/* Drag handle affordance */}
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden"
          aria-hidden="true"
        />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Done
          </button>
        </div>

        <div className="space-y-4">
          {/* ── Leagues ─────────────────────────────────────────────────── */}
          <Section title="Leagues">
            <div className="flex gap-1.5">
              {(Object.keys(LEAGUE_LABELS) as LeagueId[]).map((league) => (
                <Pill
                  key={league}
                  active={prefs.leagues.includes(league)}
                  onClick={() => toggleLeague(league)}
                >
                  {LEAGUE_LABELS[league]}
                </Pill>
              ))}
            </div>
          </Section>

          {/* ── Teams ───────────────────────────────────────────────────── */}
          <TeamPicker
            label="⭐ Your teams"
            hint="Their games get a bump, so they rise when nothing else is close. A decided blowout still fades."
            accent="bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200"
            leagues={prefs.leagues}
            selected={prefs.favorites}
            onChange={(favorites) => onChange({ favorites })}
          />

          <TeamPicker
            label="😈 Hate watch"
            hint="Their games surface only when they're in trouble — and spike if a ranked team is getting upset."
            accent="bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200"
            leagues={prefs.leagues}
            selected={prefs.rivals}
            onChange={(rivals) => onChange({ rivals })}
          />

          {/* ── Alerts ──────────────────────────────────────────────────── */}
          <Section title="Notify me at">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={40}
                max={100}
                step={1}
                value={prefs.threshold}
                onChange={(e) => onChange({ threshold: Number(e.target.value) })}
                className="flex-1 accent-rose-500"
                aria-label="Excitement threshold"
              />
              <span className="w-8 text-right text-sm font-bold tabular-nums">
                {prefs.threshold}
              </span>
            </div>
            <button
              onClick={async () => setPermission(await requestNotificationPermission())}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white active:scale-95 dark:bg-white dark:text-slate-900"
            >
              Enable browser alerts
            </button>
            {permission && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Permission: {permission}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Alerts follow the board you see, using your teams and threshold.
            </p>
          </Section>

          {/* ── Theme ───────────────────────────────────────────────────── */}
          <Section title="Appearance">
            <div className="flex gap-1.5">
              {THEMES.map((t) => (
                <Pill
                  key={t.value}
                  active={prefs.theme === t.value}
                  onClick={() => onChange({ theme: t.value })}
                >
                  {t.label}
                </Pill>
              ))}
            </div>
          </Section>

          <p className="pt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-600">
            These settings are saved in this browser only — if you share this
            link, everyone gets their own teams and threshold.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
      <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        {title}
      </p>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-400 dark:ring-white/10 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
