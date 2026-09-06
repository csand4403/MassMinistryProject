"use client";

// ─────────────────────────────────────────────────────────────────────────────
// One game on the board.
//
// Design notes (this is glanced at on a phone, in a dark room, mid-commercial):
//   • Dark-first. Evening viewing is the whole use case, and a dark ground
//     lets team colors and the excitement number carry the hierarchy.
//   • Exactly one thing is biggest: the excitement score. Everything else is
//     support. Data density is the enemy of a "where do I go" decision.
//   • Score and excitement changes animate rather than hard-cut, so a change
//     is noticed without the board flickering.
//   • The team's own color is used as a thin accent, not a fill — brand
//     recognition without wrecking contrast.
// ─────────────────────────────────────────────────────────────────────────────

import type { RankedGame, Team } from "@/lib/football/types";
import { AnimatedNumber, ChangePulse } from "./AnimatedNumber";

/** Colour bands for the excitement score. */
function scoreTone(score: number) {
  if (score >= 80)
    return {
      chip: "bg-rose-500 text-white",
      ring: "ring-rose-500/50",
      text: "text-rose-300",
      glow: "shadow-[0_0_24px_-6px_rgba(244,63,94,0.55)]",
    };
  if (score >= 60)
    return {
      chip: "bg-orange-500 text-white",
      ring: "ring-orange-500/40",
      text: "text-orange-300",
      glow: "",
    };
  if (score >= 40)
    return {
      chip: "bg-amber-500 text-slate-900",
      ring: "ring-amber-500/30",
      text: "text-amber-300",
      glow: "",
    };
  return {
    chip: "bg-slate-700 text-slate-200",
    ring: "ring-white/10",
    text: "text-slate-400",
    glow: "",
  };
}

/** ESPN gives colors without '#'. Guard against unusable near-black values. */
function accentColor(team: Team): string | null {
  if (!team.color) return null;
  const hex = team.color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex}`;
}

export function GameCard({
  entry,
  rank,
  featured = false,
}: {
  entry: RankedGame;
  rank: number;
  /** The hero card gets more room and a louder score. */
  featured?: boolean;
}) {
  const { game, excitement, sparkline, trend } = entry;
  const tone = scoreTone(excitement.score);
  const isLive = game.state === "in";
  const hot = excitement.score >= 80;

  const homePct =
    game.homeWinProbability === null
      ? null
      : Math.round(game.homeWinProbability * 100);
  const possessionId = game.situation?.possessionTeamId ?? null;

  return (
    <ChangePulse
      pulseKey={`${game.home.score}-${game.away.score}`}
      className={`rounded-2xl ring-1 ${
        hot ? `${tone.ring} ${tone.glow}` : "ring-white/10"
      } bg-white dark:bg-slate-900/70`}
    >
      <article className={featured ? "p-4 sm:p-5" : "p-3.5"}>
        {/* ── Status line ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span className="tabular-nums">#{rank}</span>
          {isLive && (
            <span className="flex shrink-0 items-center gap-1 text-rose-500 dark:text-rose-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              LIVE
            </span>
          )}
          {excitement.fandom.favorite && (
            <span
              className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5"
              title="Your team"
              aria-label="Your team"
            >
              ⭐
            </span>
          )}
          {excitement.fandom.rival && (
            <span
              className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5"
              title="Hate watch"
              aria-label="Hate watch"
            >
              😈
            </span>
          )}
          <span className="truncate normal-case tracking-normal">
            {game.statusDetail ?? ""}
          </span>
        </div>

        <div className="mt-2.5 flex items-start gap-3">
          {/* ── Teams ────────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <TeamRow
              team={game.away}
              hasPossession={possessionId === game.away.id}
              leading={game.away.score > game.home.score}
              marker={sideMarker(excitement.fandom, "away")}
              featured={featured}
            />
            <TeamRow
              team={game.home}
              hasPossession={possessionId === game.home.id}
              leading={game.home.score > game.away.score}
              marker={sideMarker(excitement.fandom, "home")}
              featured={featured}
            />
          </div>

          {/* ── Excitement ───────────────────────────────────────────────── */}
          <div className="flex shrink-0 flex-col items-center">
            <div
              className={`flex items-center justify-center rounded-xl font-bold ${tone.chip} ${
                featured ? "h-16 w-16 text-3xl" : "h-12 w-12 text-xl"
              }`}
            >
              <AnimatedNumber value={excitement.score} />
            </div>
            {trend !== 0 && (
              <span
                className={`mt-1 text-[11px] font-semibold tabular-nums ${
                  trend > 0
                    ? "text-rose-500 dark:text-rose-400"
                    : "text-slate-400 dark:text-slate-600"
                }`}
                title={`${trend > 0 ? "Up" : "Down"} ${Math.abs(trend)} in the last minute`}
              >
                {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}
              </span>
            )}
          </div>
        </div>

        {/* ── Win probability ──────────────────────────────────────────────── */}
        <div className="mt-3">
          {homePct === null ? (
            <p className="text-[11px] italic text-slate-400 dark:text-slate-600">
              No win probability — scored on margin and clock.
            </p>
          ) : (
            <>
              <div
                className="flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                role="img"
                aria-label={`Win probability: ${game.away.abbreviation} ${100 - homePct} percent, ${game.home.abbreviation} ${homePct} percent`}
              >
                <div
                  className="transition-[width] duration-700 ease-out"
                  style={{
                    width: `${100 - homePct}%`,
                    backgroundColor: accentColor(game.away) ?? "#94a3b8",
                  }}
                />
                <div
                  className="transition-[width] duration-700 ease-out"
                  style={{
                    width: `${homePct}%`,
                    backgroundColor: accentColor(game.home) ?? "#475569",
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                <span>{100 - homePct}%</span>
                <span>{homePct}%</span>
              </div>
            </>
          )}
        </div>

        {/* ── Why it's exciting ────────────────────────────────────────────── */}
        {isLive && (
          <p
            className={`mt-2.5 text-sm font-medium leading-snug ${
              hot ? tone.text : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {excitement.headline}
          </p>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            {sparkline.length > 2 && <Sparkline values={sparkline} hot={hot} />}
            {game.broadcasts.length > 0 && (
              <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
                {game.broadcasts.join(" · ")}
              </p>
            )}
          </div>

          {game.gamecastUrl && (
            <a
              href={game.gamecastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                // The hero card IS the recommendation, so its call to action
                // is always loud — muting it because the slate happens to be
                // quiet would bury the one thing the app exists to tell you.
                hot || featured
                  ? "bg-rose-500 text-white hover:bg-rose-400"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
              }`}
            >
              {hot || featured ? "Get over there →" : "Open →"}
            </a>
          )}
        </div>
      </article>
    </ChangePulse>
  );
}

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
  featured,
}: {
  team: Team;
  hasPossession: boolean;
  leading: boolean;
  marker: string | null;
  featured: boolean;
}) {
  const accent = accentColor(team);
  return (
    <div className="flex items-center gap-2">
      {/* Team color as a thin bar: recognisable, never a contrast problem. */}
      <span
        className="h-6 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: accent ?? "transparent" }}
        aria-hidden="true"
      />
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
          width={20}
          height={20}
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
      )}

      <span
        className={`min-w-0 flex-1 truncate ${featured ? "text-base" : "text-sm"} ${
          leading
            ? "font-semibold text-slate-900 dark:text-white"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {team.rank !== null && (
          <span className="mr-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
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
          <span className="ml-1 text-[10px]" title="Has possession" aria-label="Has possession">
            🏈
          </span>
        )}
      </span>

      <AnimatedNumber
        value={team.score}
        className={`shrink-0 ${featured ? "text-2xl" : "text-lg"} ${
          leading
            ? "font-bold text-slate-900 dark:text-white"
            : "font-medium text-slate-500 dark:text-slate-400"
        }`}
        upClass="text-emerald-500 dark:text-emerald-400"
      />
    </div>
  );
}

/** Inline SVG excitement trace — no charting dependency. */
function Sparkline({ values, hot }: { values: number[]; hot: boolean }) {
  const width = 88;
  const height = 20;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - (v / 100) * height).toFixed(1)}`
    )
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={hot ? "text-rose-400" : "text-slate-300 dark:text-slate-700"}
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
