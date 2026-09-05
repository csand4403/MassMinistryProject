"use client";

// ─────────────────────────────────────────────────────────────────────────────
// One game on the board: teams, score, clock, win-probability bar, excitement
// score, the "why it's exciting" line, and the Get Over There button.
//
// Built mobile-first — this is meant to be glanced at on a phone during a
// commercial break, so the excitement number and the reason are the two
// things that must be readable at arm's length.
// ─────────────────────────────────────────────────────────────────────────────

import type { RankedGame } from "@/lib/football/types";

/** Colour bands for the excitement score. */
function scoreTone(score: number): { bg: string; ring: string; text: string } {
  if (score >= 80) return { bg: "bg-red-500", ring: "ring-red-300", text: "text-red-600" };
  if (score >= 60) return { bg: "bg-orange-500", ring: "ring-orange-300", text: "text-orange-600" };
  if (score >= 40) return { bg: "bg-amber-500", ring: "ring-amber-300", text: "text-amber-600" };
  return { bg: "bg-slate-400", ring: "ring-slate-200", text: "text-slate-500" };
}

export function GameCard({ entry, rank }: { entry: RankedGame; rank: number }) {
  const { game, excitement, sparkline, trend } = entry;
  const tone = scoreTone(excitement.score);
  const isLive = game.state === "in";

  // Win-probability bar. When the provider gives us nothing, say so rather
  // than drawing a misleading 50/50 bar.
  const homeWp = game.homeWinProbability;
  const homePct = homeWp === null ? null : Math.round(homeWp * 100);

  const possessionId = game.situation?.possessionTeamId ?? null;

  return (
    <article
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${
        excitement.score >= 80 ? `${tone.ring} ring-2` : "ring-slate-200"
      }`}
    >
      {/* ── Header: rank, status, excitement ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <span className="tabular-nums">#{rank}</span>
            {isLive && (
              <span className="flex shrink-0 items-center gap-1 text-red-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                LIVE
              </span>
            )}
            {/* Icon-only: the team rows carry the same marker beside the
                actual team, and the headline spells it out, so a wordy chip
                here just wraps and squeezes out the clock on a phone. */}
            {excitement.fandom.favorite && (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5"
                title="Your team"
                aria-label="Your team"
              >
                ⭐
              </span>
            )}
            {excitement.fandom.rival && (
              <span
                className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5"
                title="Hate watch"
                aria-label="Hate watch"
              >
                😈
              </span>
            )}
            <span className="truncate">{game.statusDetail ?? ""}</span>
          </div>

          {/* ── Teams & scores ───────────────────────────────────────────── */}
          <div className="mt-2 space-y-1">
            <TeamRow
              team={game.away}
              hasPossession={possessionId === game.away.id}
              leading={game.away.score > game.home.score}
              marker={sideMarker(excitement.fandom, "away")}
            />
            <TeamRow
              team={game.home}
              hasPossession={possessionId === game.home.id}
              leading={game.home.score > game.away.score}
              marker={sideMarker(excitement.fandom, "home")}
            />
          </div>
        </div>

        {/* ── Excitement dial ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl ${tone.bg} text-2xl font-bold tabular-nums text-white shadow-sm`}
          >
            {excitement.score}
          </div>
          {trend !== 0 && (
            <span
              className={`mt-1 text-[11px] font-semibold tabular-nums ${
                trend > 0 ? "text-red-500" : "text-slate-400"
              }`}
            >
              {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}
            </span>
          )}
        </div>
      </div>

      {/* ── Win probability ──────────────────────────────────────────────── */}
      <div className="mt-3">
        {homePct === null ? (
          <p className="text-[11px] italic text-slate-400">
            No win probability for this game — score based on margin and clock.
          </p>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
              {/* Away share on the left, home on the right. */}
              <div
                className="bg-slate-400 transition-all duration-500"
                style={{ width: `${100 - homePct}%` }}
              />
              <div
                className="bg-slate-700 transition-all duration-500"
                style={{ width: `${homePct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
              <span>
                {game.away.abbreviation} {100 - homePct}%
              </span>
              <span>
                {game.home.abbreviation} {homePct}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Why it's exciting ────────────────────────────────────────────── */}
      {isLive && (
        <p className={`mt-3 text-sm font-medium ${tone.text}`}>
          {excitement.headline}
        </p>
      )}

      {/* ── Sparkline + broadcast + CTA ──────────────────────────────────── */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {sparkline.length > 2 && <Sparkline values={sparkline} />}
          {game.broadcasts.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-slate-400">
              📺 {game.broadcasts.join(", ")}
            </p>
          )}
        </div>

        {game.gamecastUrl && (
          <a
            href={game.gamecastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95 ${
              excitement.score >= 80 ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-800"
            }`}
          >
            Get Over There →
          </a>
        )}
      </div>
    </article>
  );
}

/** Which fandom marker, if any, belongs against one side of the game. */
function sideMarker(
  fandom: RankedGame["excitement"]["fandom"],
  side: "home" | "away"
): string | null {
  if (fandom.favorite === side) return "⭐";
  if (fandom.rival === side) return "😈";
  return null;
}

function TeamRow({
  team,
  hasPossession,
  leading,
  marker,
}: {
  team: RankedGame["game"]["home"];
  hasPossession: boolean;
  leading: boolean;
  marker: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="h-5 w-5 shrink-0 object-contain" width={20} height={20} />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-slate-200" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          leading ? "font-semibold text-slate-900" : "text-slate-600"
        }`}
      >
        {team.rank !== null && (
          <span className="mr-1 text-[11px] font-semibold text-slate-400">
            #{team.rank}
          </span>
        )}
        {team.abbreviation}
        {marker && (
          <span className="ml-1" aria-hidden="true">
            {marker}
          </span>
        )}
        {hasPossession && (
          // Possession indicator — a small football next to whoever has it.
          <span className="ml-1 text-[10px]" title="Has possession">
            🏈
          </span>
        )}
        {team.record && (
          <span className="ml-1 text-[11px] font-normal text-slate-400">
            ({team.record})
          </span>
        )}
      </span>
      <span
        className={`shrink-0 text-lg tabular-nums ${
          leading ? "font-bold text-slate-900" : "font-medium text-slate-500"
        }`}
      >
        {team.score}
      </span>
    </div>
  );
}

/** Tiny inline SVG trace of recent excitement — no charting dependency. */
function Sparkline({ values }: { values: number[] }) {
  const width = 80;
  const height = 18;
  const max = 100;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-slate-300"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
