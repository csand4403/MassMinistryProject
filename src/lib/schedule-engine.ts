// ─────────────────────────────────────────────────────────────────────────────
// Scheduling Engine — template-to-calendar generation, propagation, cleanup
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MassLanguage, MassType } from "@/types";
import { MASS_TYPE_LABELS, normalizeDaysOfWeek } from "@/types";
import { getHolyDayOfObligationName, getLiturgicalSeason, formatTimeLabel, inferMassTypeForDateTime, timeSortOrder } from "./liturgical-calendar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns the target days-of-week for a template.
// Handles both pre-migration int and post-migration int[] for day_of_week.
function resolveTargetDows(dbDayType: string, dbDayOfWeek: number | number[] | null): number[] | null {
  if (dbDayType === "SUNDAY") return [0];
  if (dbDayType === "WEEKDAY") {
    const days = normalizeDaysOfWeek(dbDayOfWeek);
    if (days && days.length > 0) return days;
  }
  return null; // HOLY_DAY, SCHOOL_MASS — can't auto-generate recurring dates
}

// Legacy helper used by backfillTemplateLinks (single-day)
function resolveDayOfWeek(dbDayType: string, dbDayOfWeek: number | number[] | null): number | null {
  const days = resolveTargetDows(dbDayType, dbDayOfWeek);
  return days ? days[0] : null;
}

function dateStrFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDate(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function displayNameForMassType(timeLabel: string, massType: MassType): string {
  const label = MASS_TYPE_LABELS[massType] ?? "Mass";
  return `${timeLabel} ${label}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationResult {
  liturgicalDatesCreated: number;
  massTimesCreated: number;
  massTimesLinked: number;
}

// ---------------------------------------------------------------------------
// Part 1.1 — Generate mass_time records for a template
// ---------------------------------------------------------------------------

export async function generateMassTimesForTemplate(
  supabase: SupabaseClient,
  templateId: string,
  parishId: string
): Promise<GenerationResult> {
  const result: GenerationResult = { liturgicalDatesCreated: 0, massTimesCreated: 0, massTimesLinked: 0 };

  // Fetch the template
  const { data: template, error: tErr } = await supabase
    .from("mass_template")
    .select("id, day_type, day_of_week, start_time, language, mass_type")
    .eq("id", templateId)
    .single();
  if (tErr || !template) return result;

  const targetDows = resolveTargetDows(template.day_type, template.day_of_week);
  if (!targetDows) return result; // HOLY_DAY / SCHOOL_MASS — skip

  // Build list of target dates (today … +12 months) across all target days-of-week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDaysToDate(today, 365);
  const dowSet = new Set(targetDows);

  const targetDates: string[] = [];
  let cur = new Date(today);
  while (cur <= endDate) {
    if (dowSet.has(cur.getDay())) {
      targetDates.push(dateStrFromDate(cur));
    }
    cur = addDaysToDate(cur, 1);
  }
  if (targetDates.length === 0) return result;

  // ── Ensure liturgical_date rows exist for every target date ────────────────
  const { data: existingLitDates } = await supabase
    .from("liturgical_date")
    .select("id, date, is_holy_day_of_obligation")
    .eq("parish_id", parishId)
    .in("date", targetDates);

  const litDateMap = new Map<string, string>( // date → id
    (existingLitDates ?? []).map((ld: { id: string; date: string }) => [ld.date, ld.id])
  );
  const holyDayMap = new Map<string, boolean>(
    (existingLitDates ?? []).map((ld: { date: string; is_holy_day_of_obligation: boolean }) => [
      ld.date,
      ld.is_holy_day_of_obligation,
    ])
  );

  const missingDates = targetDates.filter((d) => !litDateMap.has(d));
  if (missingDates.length > 0) {
    const rows = missingDates.map((dateStr) => {
      const holyDayName = getHolyDayOfObligationName(dateStr);
      return {
        parish_id: parishId,
        date: dateStr,
        season: getLiturgicalSeason(dateStr),
        is_high_feast: !!holyDayName,
        is_holy_day_of_obligation: !!holyDayName,
        feast_name: holyDayName,
        notes: null,
      };
    });

    const { data: newLitDates } = await supabase
      .from("liturgical_date")
      .upsert(rows, { onConflict: "parish_id,date", ignoreDuplicates: true })
      .select("id, date, is_holy_day_of_obligation");

    for (const ld of newLitDates ?? []) {
      litDateMap.set(ld.date, ld.id);
      holyDayMap.set(ld.date, ld.is_holy_day_of_obligation);
    }
    result.liturgicalDatesCreated = missingDates.length;
  }

  // Re-fetch any dates still missing (may have been inserted by another process)
  const stillMissing = targetDates.filter((d) => !litDateMap.has(d));
  if (stillMissing.length > 0) {
    const { data: refetched } = await supabase
      .from("liturgical_date")
      .select("id, date, is_holy_day_of_obligation")
      .eq("parish_id", parishId)
      .in("date", stillMissing);
    for (const ld of refetched ?? []) {
      litDateMap.set(ld.date, ld.id);
      holyDayMap.set(ld.date, ld.is_holy_day_of_obligation);
    }
  }

  // ── Ensure mass_time rows exist for every target date + time ───────────────
  const timeLabel = formatTimeLabel(template.start_time);
  const sortOrder = timeSortOrder(template.start_time);
  const litDateIds = Array.from(litDateMap.values());

  const { data: existingMassTimes } = await supabase
    .from("mass_time")
    .select("id, liturgical_date_id, template_id")
    .in("liturgical_date_id", litDateIds)
    .eq("template_id", templateId);

  const mtByLitDateId = new Map<string, { id: string; template_id: string | null }>(
    (existingMassTimes ?? []).map(
      (mt: { id: string; liturgical_date_id: string; template_id: string | null }) =>
        [mt.liturgical_date_id, { id: mt.id, template_id: mt.template_id }]
    )
  );

  const toInsert: object[] = [];
  const toLink: string[] = []; // mass_time IDs to link to this template

  for (const dateStr of targetDates) {
    const litDateId = litDateMap.get(dateStr);
    if (!litDateId) continue;

    const existing = mtByLitDateId.get(litDateId);
    if (existing) {
      if (!existing.template_id) {
        toLink.push(existing.id);
      }
      // If already linked to another template, leave it — no silent override.
    } else {
      const inferredType = inferMassTypeForDateTime(dateStr, template.start_time);
      const massType = inferredType === "HOLY_DAY_OF_OBLIGATION" || holyDayMap.get(dateStr)
        ? "HOLY_DAY_OF_OBLIGATION"
        : ((template.mass_type as MassType | null) ?? inferredType);
      toInsert.push({
        liturgical_date_id: litDateId,
        time_label: timeLabel,
        display_name: displayNameForMassType(timeLabel, massType),
        sort_order: sortOrder,
        is_special: !["DAILY_MASS", "SUNDAY_MASS", "SATURDAY_VIGIL"].includes(massType),
        template_id: templateId,
        language: template.language,
        mass_type: massType,
      });
    }
  }

  // Bulk insert in chunks to stay within PostgREST limits
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await supabase.from("mass_time").insert(toInsert.slice(i, i + CHUNK));
  }
  result.massTimesCreated = toInsert.length;

  // Link unlinked mass_times
  if (toLink.length > 0) {
    await supabase
      .from("mass_time")
      .update({ template_id: templateId })
      .in("id", toLink);
  }
  result.massTimesLinked = toLink.length;

  return result;
}

// ---------------------------------------------------------------------------
// Part 1.2 — Propagate template edits to future linked mass_times
// ---------------------------------------------------------------------------

export async function propagateTemplateUpdates(
  supabase: SupabaseClient,
  templateId: string,
  updates: {
    start_time?: string;
    language?: MassLanguage;
    mass_type?: MassType;
  }
): Promise<void> {
  if (!updates.start_time && !updates.language && !updates.mass_type) return;

  const todayStr = dateStrFromDate(new Date());

  // Find all future liturgical_dates
  const { data: futureLitDates } = await supabase
    .from("liturgical_date")
    .select("id")
    .gte("date", todayStr);

  if (!futureLitDates || futureLitDates.length === 0) return;
  const futureLitDateIds = futureLitDates.map((ld: { id: string }) => ld.id);

  // Build the update payload for mass_time
  const massTimeUpdates: Record<string, unknown> = {};
  if (updates.start_time) {
    const newLabel = formatTimeLabel(updates.start_time);
    massTimeUpdates.time_label = newLabel;
    if (updates.mass_type) {
      massTimeUpdates.display_name = displayNameForMassType(newLabel, updates.mass_type);
    } else {
      massTimeUpdates.display_name = `${newLabel} Mass`;
    }
    massTimeUpdates.sort_order = timeSortOrder(updates.start_time);
  }
  if (updates.language) {
    massTimeUpdates.language = updates.language;
  }
  if (updates.mass_type) {
    massTimeUpdates.mass_type = updates.mass_type;
    massTimeUpdates.is_special = !["DAILY_MASS", "SUNDAY_MASS", "SATURDAY_VIGIL"].includes(updates.mass_type);
    if (!updates.start_time) {
      const { data: template } = await supabase
        .from("mass_template")
        .select("start_time")
        .eq("id", templateId)
        .single();
      if (template?.start_time) {
        massTimeUpdates.display_name = displayNameForMassType(
          formatTimeLabel(template.start_time),
          updates.mass_type
        );
      }
    }
  }

  // Update future linked mass_times in chunks
  const CHUNK = 200;
  for (let i = 0; i < futureLitDateIds.length; i += CHUNK) {
    await supabase
      .from("mass_time")
      .update(massTimeUpdates)
      .eq("template_id", templateId)
      .in("liturgical_date_id", futureLitDateIds.slice(i, i + CHUNK));
  }
}

// ---------------------------------------------------------------------------
// Part 1.3 — Smart template deletion
// Unlinks future staffed mass_times; deletes unstaffed ones + empty litDates.
// ---------------------------------------------------------------------------

export async function smartDeleteTemplateMasses(
  supabase: SupabaseClient,
  templateId: string
): Promise<void> {
  const todayStr = dateStrFromDate(new Date());

  const { data: futureLitDates } = await supabase
    .from("liturgical_date")
    .select("id")
    .gte("date", todayStr);

  if (!futureLitDates || futureLitDates.length === 0) return;
  const futureLitDateIds = futureLitDates.map((ld: { id: string }) => ld.id);

  // Find all future mass_times linked to this template
  const { data: linkedMassTimes } = await supabase
    .from("mass_time")
    .select("id, liturgical_date_id")
    .eq("template_id", templateId)
    .in("liturgical_date_id", futureLitDateIds);

  if (!linkedMassTimes || linkedMassTimes.length === 0) return;

  const massTimeIds = linkedMassTimes.map((mt: { id: string }) => mt.id);

  // Check which have assignments
  const { data: assignments } = await supabase
    .from("assignment")
    .select("mass_time_id")
    .in("mass_time_id", massTimeIds);

  const staffedIds = new Set((assignments ?? []).map((a: { mass_time_id: string }) => a.mass_time_id));

  const unstaffedIds = massTimeIds.filter((id) => !staffedIds.has(id));
  const staffedMassTimeIds = massTimeIds.filter((id) => staffedIds.has(id));

  // Unlink staffed mass_times (keep the Mass, remove template association)
  if (staffedMassTimeIds.length > 0) {
    await supabase
      .from("mass_time")
      .update({ template_id: null })
      .in("id", staffedMassTimeIds);
  }

  // Delete unstaffed mass_times
  if (unstaffedIds.length > 0) {
    await supabase.from("mass_time").delete().in("id", unstaffedIds);

    // Clean up liturgical_dates that are now empty (no remaining mass_times)
    const affectedLitDateIds = linkedMassTimes
      .filter((mt: { id: string }) => unstaffedIds.includes(mt.id))
      .map((mt: { liturgical_date_id: string }) => mt.liturgical_date_id);

    if (affectedLitDateIds.length > 0) {
      const { data: remaining } = await supabase
        .from("mass_time")
        .select("liturgical_date_id")
        .in("liturgical_date_id", affectedLitDateIds);

      const stillHasMasses = new Set(
        (remaining ?? []).map((mt: { liturgical_date_id: string }) => mt.liturgical_date_id)
      );
      const toDeleteLitDateIds = affectedLitDateIds.filter((id: string) => !stillHasMasses.has(id));

      if (toDeleteLitDateIds.length > 0) {
        await supabase.from("liturgical_date").delete().in("id", toDeleteLitDateIds);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Part 1.5 — Backfill: link existing templateless mass_times to templates
// ---------------------------------------------------------------------------

export async function backfillTemplateLinks(
  supabase: SupabaseClient,
  parishId: string
): Promise<number> {
  // Fetch all templates for this parish
  const { data: templates } = await supabase
    .from("mass_template")
    .select("id, day_type, day_of_week, start_time")
    .eq("parish_id", parishId);

  if (!templates || templates.length === 0) return 0;

  // Fetch all unlinked mass_times with their liturgical dates
  const { data: unlinked } = await supabase
    .from("mass_time")
    .select("id, time_label, liturgical_date_id, liturgical_date:liturgical_date_id(date, parish_id)")
    .is("template_id", null);

  if (!unlinked || unlinked.length === 0) return 0;

  // Build a lookup: (day_of_week, time_label) → template_id
  const templateLookup = new Map<string, string>();
  for (const t of templates) {
    const dow = resolveDayOfWeek(t.day_type, t.day_of_week);
    if (dow === null) continue;
    const key = `${dow}:${formatTimeLabel(t.start_time)}`;
    templateLookup.set(key, t.id);
  }

  const updates: { id: string; template_id: string }[] = [];
  for (const mt of unlinked) {
    const ld = mt.liturgical_date as unknown as { date: string; parish_id: string } | null;
    if (!ld || ld.parish_id !== parishId) continue;
    const [y, mo, da] = ld.date.split("-").map(Number);
    const dow = new Date(y, mo - 1, da).getDay();
    const key = `${dow}:${mt.time_label}`;
    const templateId = templateLookup.get(key);
    if (templateId) {
      updates.push({ id: mt.id, template_id: templateId });
    }
  }

  for (const { id, template_id } of updates) {
    await supabase.from("mass_time").update({ template_id }).eq("id", id);
  }

  return updates.length;
}
