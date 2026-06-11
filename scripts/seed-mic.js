#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MIC Schedule Seed — creates 22 Mass Templates and generates calendar records.
// Run AFTER applying migration 006_scheduling_engine.sql in Supabase.
//
//   node scripts/seed-mic.js
//
// Requires .env.local in the project root with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf-8");
for (const line of env.split("\n")) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeEaster(year) {
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

function getAdventStart(year) {
  const nov30 = new Date(year, 10, 30);
  const dow = nov30.getDay();
  const offset = dow <= 3 ? -dow : 7 - dow;
  return new Date(year, 10, 30 + offset);
}

function getBaptismOfLord(year) {
  const jan2 = new Date(year, 0, 2);
  const dow = jan2.getDay();
  const daysToSun = dow === 0 ? 0 : 7 - dow;
  const epiphany = new Date(year, 0, 2 + daysToSun);
  return new Date(epiphany.getFullYear(), epiphany.getMonth(), epiphany.getDate() + 7);
}

function getLiturgicalSeason(dateStr) {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const asNum = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const n = y * 10000 + mo * 100 + da;
  const easter = computeEaster(y);
  const ashWed = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 46);
  const holyThur = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 3);
  const pentecost = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 49);
  const adventStart = getAdventStart(y);
  const christmas = new Date(y, 11, 25);
  const prevBaptism = getBaptismOfLord(y);
  if (n >= asNum(christmas)) return "CHRISTMAS";
  if (n < asNum(prevBaptism)) return "CHRISTMAS";
  if (n >= asNum(adventStart) && n < asNum(christmas)) return "ADVENT";
  if (n >= asNum(holyThur) && n <= asNum(easter)) return "EASTER_TRIDUUM";
  if (n > asNum(easter) && n <= asNum(pentecost)) return "EASTER";
  if (n >= asNum(ashWed) && n < asNum(holyThur)) return "LENT";
  return "ORDINARY_TIME";
}

function formatTimeLabel(startTime) {
  const [hStr, mStr] = startTime.split(":");
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, "0");
  return `${h}:${m} ${period}`;
}

function timeSortOrder(startTime) {
  const [hStr, mStr] = startTime.split(":");
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
}

function dateStrFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDate(d, n) {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

const DAY_TYPE_TO_DB = {
  SUNDAY:      { day_type: "SUNDAY",    day_of_week: null },
  SATURDAY:    { day_type: "WEEKDAY",   day_of_week: 6 },
  MONDAY:      { day_type: "WEEKDAY",   day_of_week: 1 },
  TUESDAY:     { day_type: "WEEKDAY",   day_of_week: 2 },
  WEDNESDAY:   { day_type: "WEEKDAY",   day_of_week: 3 },
  THURSDAY:    { day_type: "WEEKDAY",   day_of_week: 4 },
  FRIDAY:      { day_type: "WEEKDAY",   day_of_week: 5 },
};

// ── Generate mass_times for a single template ─────────────────────────────────

async function generateMassTimesForTemplate(templateId, parishId, dayType, dayOfWeekOverride, startTime, language) {
  const dbDow = dayOfWeekOverride;
  let targetDow;
  if (dayType === "SUNDAY") targetDow = 0;
  else if (dayType === "WEEKDAY" && dbDow !== null) targetDow = dbDow;
  else return { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDaysToDate(today, 365);

  const targetDates = [];
  let cur = new Date(today);
  while (cur <= endDate) {
    if (cur.getDay() === targetDow) targetDates.push(dateStrFromDate(cur));
    cur = addDaysToDate(cur, 1);
  }
  if (targetDates.length === 0) return { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };

  // ── Upsert liturgical_date rows (insert new, skip existing) ─────────────────
  // Note: upsert with ignoreDuplicates does not reliably return rows via
  // PostgREST, so we always follow up with an explicit SELECT to get IDs.
  const litDateMap = new Map();
  const CHUNK = 200;

  const initialRows = targetDates.map((dateStr) => ({
    parish_id: parishId,
    date: dateStr,
    season: getLiturgicalSeason(dateStr),
    is_high_feast: false,
    is_holy_day_of_obligation: false,
    feast_name: null,
    notes: null,
  }));

  for (let i = 0; i < initialRows.length; i += CHUNK) {
    const { error: upsertErr } = await supabase
      .from("liturgical_date")
      .upsert(initialRows.slice(i, i + CHUNK), { onConflict: "parish_id,date", ignoreDuplicates: true });
    if (upsertErr) {
      console.error("  ERROR upserting liturgical_dates:", upsertErr.message);
      return { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };
    }
  }

  // Always SELECT to get IDs — never rely on upsert return value
  const { data: allLitDates, error: fetchErr } = await supabase
    .from("liturgical_date")
    .select("id, date")
    .eq("parish_id", parishId)
    .in("date", targetDates);
  if (fetchErr) {
    console.error("  ERROR fetching liturgical_date IDs:", fetchErr.message);
    return { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };
  }
  for (const ld of allLitDates ?? []) litDateMap.set(ld.date, ld.id);

  // Dates we just inserted = target dates that weren't already in the map before upsert.
  // Since we rebuilt the map from the fresh SELECT, count how many exist now.
  const liturgicalDatesCreated = allLitDates ? allLitDates.length : 0;

  const timeLabel = formatTimeLabel(startTime);
  const sortOrder = timeSortOrder(startTime);
  const litDateIds = Array.from(litDateMap.values());

  if (litDateIds.length === 0) {
    console.error("  ERROR: litDateMap empty after upsert+fetch — check table permissions.");
    return { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };
  }

  // ── Fetch existing mass_times for these dates ─────────────────────────────
  const { data: existingMassTimes, error: mtFetchErr } = await supabase
    .from("mass_time")
    .select("id, liturgical_date_id, template_id")
    .in("liturgical_date_id", litDateIds)
    .eq("time_label", timeLabel);
  if (mtFetchErr) {
    console.error("  ERROR fetching existing mass_times:", mtFetchErr.message);
    return { liturgicalDatesCreated, massTimesCreated: 0, massTimesLinked: 0 };
  }

  const mtByLitDateId = new Map(
    (existingMassTimes ?? []).map((mt) => [mt.liturgical_date_id, { id: mt.id, template_id: mt.template_id }])
  );

  const toInsert = [];
  const toLink = [];

  for (const dateStr of targetDates) {
    const litDateId = litDateMap.get(dateStr);
    if (!litDateId) continue;
    const existing = mtByLitDateId.get(litDateId);
    if (existing) {
      if (!existing.template_id) toLink.push(existing.id);
    } else {
      toInsert.push({
        liturgical_date_id: litDateId,
        time_label: timeLabel,
        display_name: `${timeLabel} Mass`,
        sort_order: sortOrder,
        is_special: false,
        template_id: templateId,
        language,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const { error } = await supabase.from("mass_time").insert(toInsert.slice(i, i + CHUNK));
    if (error) console.warn("  mass_time insert warning:", error.message);
  }

  if (toLink.length > 0) {
    await supabase.from("mass_time").update({ template_id: templateId }).in("id", toLink);
  }

  return { liturgicalDatesCreated, massTimesCreated: toInsert.length, massTimesLinked: toLink.length };
}

// ── Create or find a template ─────────────────────────────────────────────────

async function upsertTemplate(parishId, templateDef) {
  const { uiDayType, startTime, language, name, roleCfgs } = templateDef;
  const { day_type: dbDayType, day_of_week: dbDayOfWeek } = DAY_TYPE_TO_DB[uiDayType];

  // Check if already exists by name
  const { data: existing } = await supabase
    .from("mass_template")
    .select("id")
    .eq("parish_id", parishId)
    .eq("name", name)
    .maybeSingle();

  let templateId;
  if (existing) {
    templateId = existing.id;
    console.log(`  [skip] Template already exists: "${name}"`);
    return { templateId, dbDayType, dbDayOfWeek, created: false };
  }

  const { data: tmpl, error } = await supabase
    .from("mass_template")
    .insert({
      parish_id: parishId,
      name,
      day_type: dbDayType,
      day_of_week: dbDayOfWeek,
      start_time: startTime,
      language,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create template "${name}": ${error.message}`);
  templateId = tmpl.id;

  // Role configs
  const roleRows = roleCfgs
    .filter((rc) => rc.min_count > 0 || rc.max_count > 0)
    .map((rc) => ({ template_id: templateId, ...rc }));

  if (roleRows.length > 0) {
    const { error: rcErr } = await supabase.from("mass_template_role").insert(roleRows);
    if (rcErr) console.warn(`  role config warning for "${name}": ${rcErr.message}`);
  }

  console.log(`  [created] "${name}"`);
  return { templateId, dbDayType, dbDayOfWeek, created: true };
}

// ── MIC Schedule definition ───────────────────────────────────────────────────

const SUNDAY_ROLES = [
  { role: "CELEBRANT",    min_count: 1, max_count: 1 },
  { role: "EMHC",         min_count: 2, max_count: 6 },
  { role: "LECTOR_1",     min_count: 1, max_count: 1 },
  { role: "LECTOR_2",     min_count: 0, max_count: 1 },
  { role: "USHER",        min_count: 2, max_count: 4 },
];

const WEEKDAY_ROLES = [
  { role: "CELEBRANT",    min_count: 1, max_count: 1 },
  { role: "EMHC",         min_count: 0, max_count: 2 },
  { role: "LECTOR_1",     min_count: 0, max_count: 1 },
  { role: "USHER",        min_count: 0, max_count: 1 },
];

const TEMPLATES = [
  // ── Sunday ──
  { uiDayType: "SUNDAY",    startTime: "07:30", language: "ENGLISH", name: "Sunday 7:30 AM (English)",   roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "09:00", language: "SPANISH", name: "Sunday 9:00 AM (Spanish)",   roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "10:45", language: "ENGLISH", name: "Sunday 10:45 AM (English)",  roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "12:10", language: "ENGLISH", name: "Sunday 12:10 PM (English)",  roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "13:30", language: "FRENCH",  name: "Sunday 1:30 PM (French)",    roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "15:00", language: "SPANISH", name: "Sunday 3:00 PM (Spanish)",   roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "17:00", language: "ENGLISH", name: "Sunday 5:00 PM (English)",   roleCfgs: SUNDAY_ROLES },
  { uiDayType: "SUNDAY",    startTime: "18:30", language: "SPANISH", name: "Sunday 6:30 PM (Spanish)",   roleCfgs: SUNDAY_ROLES },
  // ── Saturday ──
  { uiDayType: "SATURDAY",  startTime: "08:00", language: "ENGLISH", name: "Saturday 8:00 AM (English)", roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "SATURDAY",  startTime: "17:00", language: "ENGLISH", name: "Saturday 5:00 PM Vigil (English)", roleCfgs: SUNDAY_ROLES },
  // ── Monday ──
  { uiDayType: "MONDAY",    startTime: "08:15", language: "ENGLISH", name: "Monday 8:15 AM (English)",   roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "MONDAY",    startTime: "17:30", language: "ENGLISH", name: "Monday 5:30 PM (English)",   roleCfgs: WEEKDAY_ROLES },
  // ── Tuesday ──
  { uiDayType: "TUESDAY",   startTime: "08:00", language: "ENGLISH", name: "Tuesday 8:00 AM (English)",  roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "TUESDAY",   startTime: "17:30", language: "ENGLISH", name: "Tuesday 5:30 PM (English)",  roleCfgs: WEEKDAY_ROLES },
  // ── Wednesday ──
  { uiDayType: "WEDNESDAY", startTime: "08:15", language: "ENGLISH", name: "Wednesday 8:15 AM (English)",roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "WEDNESDAY", startTime: "17:30", language: "ENGLISH", name: "Wednesday 5:30 PM (English)",roleCfgs: WEEKDAY_ROLES },
  // ── Thursday ──
  { uiDayType: "THURSDAY",  startTime: "08:00", language: "ENGLISH", name: "Thursday 8:00 AM (English)", roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "THURSDAY",  startTime: "17:30", language: "ENGLISH", name: "Thursday 5:30 PM (English)", roleCfgs: WEEKDAY_ROLES },
  // ── Friday ──
  { uiDayType: "FRIDAY",    startTime: "08:15", language: "ENGLISH", name: "Friday 8:15 AM (English)",   roleCfgs: WEEKDAY_ROLES },
  { uiDayType: "FRIDAY",    startTime: "17:30", language: "ENGLISH", name: "Friday 5:30 PM (English)",   roleCfgs: WEEKDAY_ROLES },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("MIC Schedule Seed");
  console.log("=".repeat(50));

  // Get parish
  const { data: parish, error: pErr } = await supabase.from("parish").select("id, name").single();
  if (pErr) { console.error("Failed to fetch parish:", pErr.message); process.exit(1); }
  console.log(`Parish: ${parish.name} (${parish.id})\n`);

  let totalTemplates = 0;
  let totalLitDates = 0;
  let totalMassTimes = 0;

  console.log("Creating templates + generating calendar records…\n");

  for (const tmplDef of TEMPLATES) {
    const { templateId, dbDayType, dbDayOfWeek, created } = await upsertTemplate(parish.id, tmplDef);
    totalTemplates++;

    const gen = await generateMassTimesForTemplate(
      templateId, parish.id, dbDayType, dbDayOfWeek,
      tmplDef.startTime, tmplDef.language
    );
    totalLitDates += gen.liturgicalDatesCreated;
    totalMassTimes += gen.massTimesCreated + gen.massTimesLinked;
    console.log(`    → ${gen.liturgicalDatesCreated} dates, ${gen.massTimesCreated} new mass_times, ${gen.massTimesLinked} linked`);
  }

  // Count final totals — use count:"exact" and surface errors explicitly
  const [tmplRes, mtRes, ldRes] = await Promise.all([
    supabase.from("mass_template").select("*", { count: "exact", head: true }),
    supabase.from("mass_time").select("*", { count: "exact", head: true }),
    supabase.from("liturgical_date").select("*", { count: "exact", head: true }),
  ]);

  if (tmplRes.error) console.error("  count error (mass_template):", tmplRes.error.message);
  if (mtRes.error)   console.error("  count error (mass_time):", mtRes.error.message);
  if (ldRes.error)   console.error("  count error (liturgical_date):", ldRes.error.message);

  console.log("\n" + "=".repeat(50));
  console.log("SEED COMPLETE");
  console.log(`  Templates in DB:         ${tmplRes.count ?? "error"}`);
  console.log(`  Mass Time records in DB: ${mtRes.count ?? "error"}`);
  console.log(`  Liturgical Date records: ${ldRes.count ?? "error"}`);
  console.log(`  Created this run:        ${totalTemplates} templates, ${totalMassTimes} mass_times, ${totalLitDates} liturgical_dates`);
  console.log("=".repeat(50));
}

main().catch((e) => { console.error(e); process.exit(1); });
