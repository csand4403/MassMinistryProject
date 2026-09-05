"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The board.
//
// Structure follows the one question this app answers: "where should I be
// right now?" So there is a single hero answer at the top, then the ranked
// remainder. Everything is re-ranked per browser from this viewer's own team
// picks (see usePersonalizedGames), so a shared URL is safe to hand around.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "./GameCard";
import { SettingsSheet } from "./SettingsSheet";
import { useGameday, usePersonalizedGames, type ConnectionState } from "./useGameday";
import { useViewerPrefs, useTheme } from "./useViewerPrefs";

type Filter = "live" | "all";

export function Dashboard() {
  const { snapshot, connection, refresh } = useGameday();
  const { prefs, update, loaded } = useViewerPrefs();
  useTheme(prefs.theme);

  const games = usePersonalizedGames(snapshot, prefs);
  const [filter, setFilter] = useState<Filter>("live");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const liveGames = useMemo(
    () => games.filter((g) => g.game.state === "in"),
    [games]
  );
  const upcoming = useMemo(
    () => games.filter((g) => g.game.state === "pre"),
    [games]
  );

  const top = liveGames[0] ?? null;
  const visible = filter === "live" ? liveGames : games;
  const rest = top ? visible.filter((e) => e.game.id !== top.game.id) : visible;

  // Browser notifications use THIS viewer's threshold against THIS viewer's
  // personalized scores, so alerts match the board they're looking at.
  useLocalAlerts(liveGames, prefs.threshold);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0a0e17] dark:text-slate-100">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/85 backdrop-blur dark:border-white/10 dark:bg-[#0a0e17]/85">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight">
                Get Over There Now
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <ConnectionDot state={connection} />
                <span>
                  {liveGames.length > 0
                    ? `${liveGames.length} live`
                    : "nothing live"}
                </span>
                {snapshot?.lastPollAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <LastUpdated at={snapshot.lastPollAt} />
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton label="Refresh now" onClick={refresh}>
                ↻
              </IconButton>
              <IconButton
                label="Settings"
                onClick={() => setSettingsOpen(true)}
                badge={prefs.favorites.length + prefs.rivals.length || undefined}
              >
                ⚙
              </IconButton>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
        {snapshot?.lastPollError && (
          <div className="mb-4 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Last refresh failed: {snapshot.lastPollError}
          </div>
        )}

        {/* ── The answer ──────────────────────────────────────────────────── */}
        {top && (
          <section className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
              Watch this one
            </h2>
            <GameCard entry={top} rank={1} featured />
          </section>
        )}

        {/* ── Filter ──────────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center gap-1.5">
          <FilterTab
            label={`Live ${liveGames.length}`}
            active={filter === "live"}
            onClick={() => setFilter("live")}
          />
          <FilterTab
            label={`All ${games.length}`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>

        {/* ── The rest ────────────────────────────────────────────────────── */}
        {!snapshot || !loaded ? (
          <SkeletonBoard />
        ) : rest.length === 0 ? (
          <EmptyState upcoming={upcoming.length} hasTop={top !== null} />
        ) : (
          <div className="space-y-2.5">
            {rest.map((entry, i) => (
              <GameCard
                key={entry.game.id}
                entry={entry}
                rank={top ? i + 2 : i + 1}
              />
            ))}
          </div>
        )}

        <footer className="mt-10 text-center text-[11px] text-slate-400 dark:text-slate-600">
          Data: {snapshot?.provider ?? "—"} · excitement is a heuristic, not gospel
        </footer>
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onChange={update}
      />
    </div>
  );
}

/**
 * Raise a browser notification when a game crosses this viewer's threshold.
 *
 * Mirrors the server's debounce shape: alert once per game, and only re-arm
 * after it drops meaningfully below the threshold. Without the re-arm a game
 * hovering at the line would notify on every poll.
 */
function useLocalAlerts(
  liveGames: ReturnType<typeof usePersonalizedGames>,
  threshold: number
) {
  const armed = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    for (const entry of liveGames) {
      const id = entry.game.id;
      const score = entry.excitement.score;
      const isArmed = armed.current.get(id) ?? true;

      if (score >= threshold && isArmed) {
        armed.current.set(id, false);
        try {
          new Notification(
            `${entry.game.away.abbreviation} ${entry.game.away.score}-${entry.game.home.score} ${entry.game.home.abbreviation} · ${score}`,
            { body: entry.excitement.headline, tag: id }
          );
        } catch {
          // Some browsers only allow notifications from a service worker.
        }
      } else if (score <= threshold - 10) {
        armed.current.set(id, true);
      }
    }
  }, [liveGames, threshold]);
}

function IconButton({
  label,
  onClick,
  children,
  badge,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-base text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10"
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900">
          {badge}
        </span>
      )}
    </button>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-400 dark:ring-white/10 dark:hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function ConnectionDot({ state }: { state: ConnectionState }) {
  const map: Record<ConnectionState, { color: string; label: string }> = {
    connecting: { color: "bg-slate-400", label: "Connecting" },
    live: { color: "bg-emerald-500", label: "Live updates" },
    polling: { color: "bg-amber-500", label: "Polling" },
    error: { color: "bg-rose-500", label: "Offline" },
  };
  const { color, label } = map[state];
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}

/** Ticks on its own so "12s ago" stays honest between polls. */
function LastUpdated({ at }: { at: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  const text =
    seconds < 60
      ? `${seconds}s ago`
      : seconds < 3600
        ? `${Math.round(seconds / 60)}m ago`
        : `${Math.round(seconds / 3600)}h ago`;
  return <span>updated {text}</span>;
}

function EmptyState({
  upcoming,
  hasTop,
}: {
  upcoming: number;
  hasTop: boolean;
}) {
  if (hasTop) {
    return (
      <div className="rounded-2xl px-4 py-5 text-center text-xs text-slate-400 ring-1 ring-slate-200 dark:text-slate-500 dark:ring-white/10">
        That&apos;s the only game live right now.
      </div>
    );
  }
  return (
    <div className="rounded-2xl px-4 py-12 text-center ring-1 ring-slate-200 dark:ring-white/10">
      <p className="text-3xl">🏈</p>
      <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        Nothing live right now
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {upcoming > 0
          ? `${upcoming} game${upcoming === 1 ? "" : "s"} scheduled — the board wakes up at kickoff.`
          : "Check back on game day."}
      </p>
    </div>
  );
}

function SkeletonBoard() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-white/5"
        />
      ))}
    </div>
  );
}
