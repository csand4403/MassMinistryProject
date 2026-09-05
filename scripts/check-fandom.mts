#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Behavior check for the favorite / hate-watch scoring.
//
//   npm run check:fandom
//
// Runs a fixed set of scenarios through the real scorer and asserts the
// properties the feature is supposed to have. Run this after touching any
// EXCITEMENT_CONFIG value — the fandom bonuses are easy to tune into a state
// where your team's blowout outranks a good neutral game, and this catches it.
//
// Exits non-zero if any behavior regresses.
// ─────────────────────────────────────────────────────────────────────────────

import { computeExcitement, fandomKey, NO_FANDOM } from "../src/lib/football/excitement.ts";
import type { LiveGame } from "../src/lib/football/types.ts";

const L = "college-football" as const;
function team(id: string, abbr: string, score: number, rank: number | null = null) {
  return { id, abbreviation: abbr, name: abbr, displayName: abbr, score, color: null, logo: null, record: null, rank };
}
function game(o: {
  id: string; home: any; away: any; period: number; clock: string; secs: number;
  wp: number | null; redZone?: boolean; down?: number | null;
}): LiveGame {
  return {
    id: `${L}:${o.id}`, league: L, state: "in", home: o.home, away: o.away,
    period: o.period, displayClock: o.clock, clockSeconds: 0, secondsRemaining: o.secs,
    statusDetail: `${o.clock} - Q${o.period}`, isOvertime: false, isStopped: false,
    homeWinProbability: o.wp,
    situation: { down: o.down ?? null, distance: 10, isRedZone: o.redZone ?? false, yardsToGoal: 40,
                 possessionTeamId: null, downDistanceText: null, lastPlayText: null, lastPlayType: null },
    broadcasts: [], gamecastUrl: null, startDate: null, fetchedAt: Date.now(),
  };
}

const MY = "194";     // Ohio State
const RIVAL = "130";  // Michigan
const fandom = {
  favorites: new Set([fandomKey(L, MY)]),
  rivals: new Set([fandomKey(L, RIVAL)]),
};

// ── The board ───────────────────────────────────────────────────────────────
const scenarios: Record<string, LiveGame> = {
  "neutral boring Q1 (0-0)":            game({id:"a", home:team("1","AAA",0), away:team("2","BBB",0), period:1, clock:"9:00", secs:3140, wp:0.52}),
  "neutral competitive Q2 (7-10)":      game({id:"b", home:team("3","CCC",10), away:team("4","DDD",7), period:2, clock:"5:00", secs:2100, wp:0.60}),
  "neutral LATE THRILLER (24-27 Q4)":   game({id:"c", home:team("5","EEE",27), away:team("6","FFF",24), period:4, clock:"0:50", secs:50, wp:0.52, redZone:true, down:4}),
  "MY TEAM typical Q1 (0-0)":           game({id:"d", home:team(MY,"OSU",0), away:team("7","GGG",0), period:1, clock:"9:00", secs:3140, wp:0.55}),
  "MY TEAM blown out (0-35)":           game({id:"e", home:team(MY,"OSU",0), away:team("8","HHH",35), period:3, clock:"5:00", secs:1200, wp:0.01}),
  "RIVAL cruising to a win (35-3)":     game({id:"f", home:team(RIVAL,"MICH",35,4), away:team("9","III",3), period:3, clock:"5:00", secs:1200, wp:0.99}),
  "RIVAL BEING UPSET late (17-21)":     game({id:"g", home:team(RIVAL,"MICH",17,4), away:team("10","JJJ",21), period:4, clock:"1:10", secs:70, wp:0.22}),
};

console.log("Ohio State fan who hates Michigan.\n");
console.log("scenario                              neutral  ->  with fandom   delta");
console.log("─".repeat(78));
const rows: {name:string; base:number; fan:number}[] = [];
for (const [name, g] of Object.entries(scenarios)) {
  const base = computeExcitement(g, [], Date.now(), NO_FANDOM).score;
  const fan  = computeExcitement(g, [], Date.now(), fandom).score;
  rows.push({name, base, fan});
  console.log(`${name.padEnd(38)}${String(base).padStart(5)}  ->  ${String(fan).padStart(6)}      ${fan-base>=0?"+":""}${fan-base}`);
}

console.log("\nRanked board WITH fandom:");
for (const [i,r] of [...rows].sort((a,b)=>b.fan-a.fan).entries()) {
  console.log(`  ${i+1}. ${String(r.fan).padStart(3)}  ${r.name}`);
}

// ── Behavioral assertions ─────────────────────────────────────────────────
const get = (n:string)=>rows.find(r=>r.name===n)!;
const checks: [string, boolean][] = [
  ["favorite's normal game tops a boring slate",
    get("MY TEAM typical Q1 (0-0)").fan > get("neutral boring Q1 (0-0)").fan &&
    get("MY TEAM typical Q1 (0-0)").fan > get("neutral competitive Q2 (7-10)").fan],
  ["favorite does NOT beat a genuine late thriller",
    get("MY TEAM typical Q1 (0-0)").fan < get("neutral LATE THRILLER (24-27 Q4)").fan],
  ["favorite being blown out stays below a competitive neutral game",
    get("MY TEAM blown out (0-35)").fan < get("neutral competitive Q2 (7-10)").fan],
  ["rival being upset late spikes hard",
    get("RIVAL BEING UPSET late (17-21)").fan - get("RIVAL BEING UPSET late (17-21)").base >= 25],
  ["rival cruising to a win gets ~no bump",
    get("RIVAL cruising to a win (35-3)").fan - get("RIVAL cruising to a win (35-3)").base <= 3],
  ["neutral games are completely unaffected",
    get("neutral boring Q1 (0-0)").fan === get("neutral boring Q1 (0-0)").base &&
    get("neutral LATE THRILLER (24-27 Q4)").fan === get("neutral LATE THRILLER (24-27 Q4)").base],
];
console.log("\nBehavior checks:");
let ok = true;
for (const [label, pass] of checks) { console.log(`  ${pass?"✅":"❌"} ${label}`); ok &&= pass; }
process.exit(ok?0:1);
