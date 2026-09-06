"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Searchable team picker used for both the favorites and the hate-watch list.
//
// The league team list is ~760 entries for college football, so it is fetched
// once, cached in module scope for the session, and filtered client-side —
// typing stays instant and the server isn't hit on every keystroke.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import type { LeagueId, TeamRef } from "@/lib/football/types";

/** Session cache: league -> full team list. */
const teamCache = new Map<LeagueId, TeamRef[]>();

async function loadTeams(league: LeagueId): Promise<TeamRef[]> {
  const cached = teamCache.get(league);
  if (cached) return cached;
  const res = await fetch(`/api/gameday/teams?league=${league}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { teams?: TeamRef[] };
  const teams = data.teams ?? [];
  teamCache.set(league, teams);
  return teams;
}

export function TeamPicker({
  label,
  hint,
  accent,
  leagues,
  selected,
  onChange,
}: {
  label: string;
  hint: string;
  /** Tailwind classes for the selected chips — distinguishes love from hate. */
  accent: string;
  leagues: LeagueId[];
  selected: TeamRef[];
  onChange: (teams: TeamRef[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the team lists for whichever leagues are active.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(leagues.map(loadTeams))
      .then((lists) => {
        if (cancelled) return;
        setTeams(lists.flat());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagues]);

  // Close the dropdown on an outside tap — important on a phone, where there
  // is no Escape key to hand.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectedKeys = useMemo(
    () => new Set(selected.map((t) => `${t.league}:${t.id}`)),
    [selected]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return teams
      .filter(
        (t) =>
          !selectedKeys.has(`${t.league}:${t.id}`) &&
          (t.displayName.toLowerCase().includes(q) ||
            t.abbreviation.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, teams, selectedKeys]);

  const add = (team: TeamRef) => {
    onChange([...selected, team]);
    setQuery("");
    setOpen(false);
  };

  const remove = (team: TeamRef) => {
    onChange(
      selected.filter((t) => !(t.league === team.league && t.id === team.id))
    );
  };

  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5" ref={boxRef}>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>

      {/* ── Current picks ─────────────────────────────────────────────────── */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((team) => (
            <button
              key={`${team.league}:${team.id}`}
              onClick={() => remove(team)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${accent}`}
              title={`Remove ${team.displayName}`}
            >
              {team.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo} alt="" className="h-3.5 w-3.5 object-contain" />
              )}
              {team.displayName}
              <span aria-hidden="true" className="opacity-60">
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative mt-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? "Loading teams…" : "Search teams…"}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        {open && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-800">
            {matches.map((team) => (
              <li key={`${team.league}:${team.id}`}>
                <button
                  onClick={() => add(team)}
                  className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/10"
                >
                  {team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{team.displayName}</span>
                  <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                    {team.abbreviation}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}
