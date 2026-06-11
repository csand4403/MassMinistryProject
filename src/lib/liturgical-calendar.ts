// ─────────────────────────────────────────────────────────────────────────────
// Liturgical Calendar Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { LiturgicalSeason, MassType } from "@/types";

// Returns Easter Sunday for a given year (Gregorian algorithm).
export function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// Returns the first Sunday of Advent (the Sunday nearest to November 30).
function getAdventStart(year: number): Date {
  const nov30 = new Date(year, 10, 30);
  const dow = nov30.getDay(); // 0=Sun
  const offset = dow <= 3 ? -dow : 7 - dow;
  return new Date(year, 10, 30 + offset);
}

// Returns Baptism of the Lord (Sunday after Epiphany; Epiphany = Sun between Jan 2–8).
function getBaptismOfLord(year: number): Date {
  const jan2 = new Date(year, 0, 2);
  const dow = jan2.getDay();
  const daysToSun = dow === 0 ? 0 : 7 - dow;
  const epiphany = new Date(year, 0, 2 + daysToSun);
  return new Date(epiphany.getFullYear(), epiphany.getMonth(), epiphany.getDate() + 7);
}

// Returns the liturgical season for an ISO date string ("YYYY-MM-DD").
export function getLiturgicalSeason(dateStr: string): LiturgicalSeason {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const year = y;

  // Work with numeric date values to avoid timezone surprises.
  const asNum = (d: Date) =>
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const n = year * 10000 + mo * 100 + da;

  const easter = computeEaster(year);
  const ashWed = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 46);
  const holyThur = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 3);
  const pentecost = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 49);
  const adventStart = getAdventStart(year);
  const christmas = new Date(year, 11, 25);
  const baptism = getBaptismOfLord(year + 1); // January of next year
  const prevBaptism = getBaptismOfLord(year);  // January of this year

  const nAshWed = asNum(ashWed);
  const nHolyThur = asNum(holyThur);
  const nEaster = asNum(easter);
  const nPentecost = asNum(pentecost);
  const nAdvent = asNum(adventStart);
  const nChristmas = asNum(christmas);
  const nBaptism = asNum(baptism);
  const nPrevBaptism = asNum(prevBaptism);

  // Christmas season: Dec 25 through Baptism of Lord (Jan of next year)
  if (n >= nChristmas) return "CHRISTMAS";
  if (n < nPrevBaptism) return "CHRISTMAS";

  // Advent: first Sunday of Advent through Dec 24
  if (n >= nAdvent && n < nChristmas) return "ADVENT";

  // Easter Triduum: Holy Thursday through Easter Sunday (inclusive)
  if (n >= nHolyThur && n <= nEaster) return "EASTER_TRIDUUM";

  // Easter season: day after Easter through Pentecost
  if (n > nEaster && n <= nPentecost) return "EASTER";

  // Lent: Ash Wednesday through Wednesday of Holy Week
  if (n >= nAshWed && n < nHolyThur) return "LENT";

  // Everything else: Ordinary Time
  return "ORDINARY_TIME";
}

// Converts a 24h "HH:MM" time string to a display label like "7:30 AM".
export function formatTimeLabel(startTime: string): string {
  const [hStr, mStr] = startTime.split(":");
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, "0");
  return `${h}:${m} ${period}`;
}

// Returns a numeric sort key from a "HH:MM" start time (hours*60 + minutes).
export function timeSortOrder(startTime: string): number {
  const [hStr, mStr] = startTime.split(":");
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
}

export function getHolyDayOfObligationName(dateStr: string): string | null {
  const [, month, day] = dateStr.split("-").map(Number);
  const fixedHolyDays: Record<string, string> = {
    "01-01": "Solemnity of Mary, Mother of God",
    "08-15": "Assumption of the Blessed Virgin Mary",
    "11-01": "All Saints",
    "12-08": "Immaculate Conception",
    "12-25": "Christmas",
  };
  return fixedHolyDays[`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`] ?? null;
}

export function isHolyDayOfObligation(dateStr: string): boolean {
  return getHolyDayOfObligationName(dateStr) !== null;
}

export function massTypeForDate(dateStr: string): MassType {
  return isHolyDayOfObligation(dateStr) ? "HOLY_DAY_OF_OBLIGATION" : "REGULAR";
}
