"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The main board. Top card is the answer to "where should I be right now?";
// everything below is the ranked remainder.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { GameCard } from "./GameCard";
import { AlertSettingsPanel } from "./AlertSettingsPanel";
import { useGameday, type ConnectionState } from "./useGameday";

type Filter = "live" | "all";

export function Dashboard() {
  const { snapshot, connection, saveSettings } = useGameday();
  const [filter, setFilter] = useState<Filter>("live");

  const games = snapshot?.games ?? [];
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
  // The top game already has its own hero card above; showing it again in the
  // list below is just noise.
  const rest = top ? visible.filter((e) => e.game.id !== top.game.id) : visible;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-5">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="mb-4">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Get Over There Now
            </h1>
            <ConnectionBadge state={connection} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {liveGames.length > 0
              ? `${liveGames.length} game${liveGames.length === 1 ? "" : "s"} live`
              : "No games in progress"}
            {snapshot?.lastPollAt && (
              <> · updated {formatAgo(snapshot.lastPollAt, snapshot.serverTime)}</>
            )}
          </p>
        </header>

        {snapshot?.lastPollError && (
          <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Last refresh failed: {snapshot.lastPollError}
          </div>
        )}

        {/* ── The recommendation ───────────────────────────────────────── */}
        {top && (
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Watch this one
            </p>
            <GameCard entry={top} rank={1} />
          </div>
        )}

        {/* ── Settings ─────────────────────────────────────────────────── */}
        {snapshot && (
          <div className="mb-4">
            <AlertSettingsPanel
              settings={snapshot.settings}
              onChange={saveSettings}
            />
          </div>
        )}

        {/* ── Filter ───────────────────────────────────────────────────── */}
        <div className="mb-3 flex gap-1.5">
          <FilterTab
            label={`Live (${liveGames.length})`}
            active={filter === "live"}
            onClick={() => setFilter("live")}
          />
          <FilterTab
            label={`All (${games.length})`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>

        {/* ── The board ────────────────────────────────────────────────── */}
        {!snapshot ? (
          <SkeletonBoard />
        ) : rest.length === 0 ? (
          <EmptyState upcoming={upcoming.length} hasTop={top !== null} />
        ) : (
          <div className="space-y-3">
            {rest.map((entry, i) => (
              <GameCard
                key={entry.game.id}
                entry={entry}
                rank={top ? i + 2 : i + 1}
              />
            ))}
          </div>
        )}

        <footer className="mt-8 pb-6 text-center text-[11px] text-slate-400">
          Data: {snapshot?.provider ?? "—"} · Excitement is a heuristic, not gospel
        </footer>
      </div>
    </div>
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
          ? "bg-slate-800 text-white"
          : "bg-white text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const map: Record<ConnectionState, { label: string; className: string }> = {
    connecting: { label: "connecting", className: "bg-slate-100 text-slate-500" },
    live: { label: "live", className: "bg-green-100 text-green-700" },
    polling: { label: "polling", className: "bg-amber-100 text-amber-700" },
    error: { label: "offline", className: "bg-red-100 text-red-700" },
  };
  const { label, className } = map[state];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

function EmptyState({
  upcoming,
  hasTop,
}: {
  upcoming: number;
  hasTop: boolean;
}) {
  // If a hero card is showing, the board isn't empty — that one game is simply
  // the only thing live.
  if (hasTop) {
    return (
      <div className="rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-500 shadow-sm ring-1 ring-slate-200">
        That&apos;s the only game live right now.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-sm ring-1 ring-slate-200">
      <p className="text-3xl">🏈</p>
      <p className="mt-2 text-sm font-medium text-slate-700">
        Nothing live right now
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {upcoming > 0
          ? `${upcoming} game${upcoming === 1 ? "" : "s"} scheduled. The board wakes up automatically at kickoff.`
          : "Check back on game day."}
      </p>
    </div>
  );
}

function SkeletonBoard() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
        />
      ))}
    </div>
  );
}

/** "12s ago" / "3m ago" — compact enough for the header line. */
function formatAgo(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
