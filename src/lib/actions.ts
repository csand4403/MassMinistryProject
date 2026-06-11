"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MinisterRole, AssignmentStatus, MassDayType, MassLanguage, PriestType, MassStatus, MassType, MassTag, Minister } from "@/types";
import { DAY_TYPE_TO_DB, MASS_TAG_OPTIONS, MASS_TYPE_LABELS, ROLE_DISPLAY_ORDER } from "@/types";
import { formatTimeLabel, getHolyDayOfObligationName, getLiturgicalSeason, inferMassTypeForDateTime, isHolyDayOfObligation, timeSortOrder } from "@/lib/liturgical-calendar";
import {
  generateMassTimesForTemplate,
  propagateTemplateUpdates,
  smartDeleteTemplateMasses,
  backfillTemplateLinks,
} from "@/lib/schedule-engine";

function inferMassTypeForTemplate(
  dayType: MassDayType,
  daysOfWeek: number[] | null,
  startTime: string
): MassType {
  if (dayType === "SUNDAY") return "SUNDAY_MASS";
  if (dayType === "HOLY_DAY") return "HOLY_DAY_OF_OBLIGATION";
  if (dayType === "SCHOOL_MASS") return "SCHOOL_MASS";
  if (daysOfWeek?.length === 1 && daysOfWeek[0] === 6 && startTime >= "16:00") {
    return "SATURDAY_VIGIL";
  }
  return "DAILY_MASS";
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export async function checkInMinister(
  assignmentId: string,
  checkedInBy: string = "coordinator"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error: ciError } = await supabase
    .from("check_in")
    .upsert(
      { assignment_id: assignmentId, checked_in_by: checkedInBy },
      { onConflict: "assignment_id" }
    );
  if (ciError) return { success: false, error: ciError.message };

  const { error: aError } = await supabase
    .from("assignment")
    .update({ status: "CHECKED_IN" as AssignmentStatus })
    .eq("id", assignmentId);
  if (aError) return { success: false, error: aError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function uncheckInMinister(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error: ciError } = await supabase
    .from("check_in")
    .delete()
    .eq("assignment_id", assignmentId);
  if (ciError) return { success: false, error: ciError.message };

  const { error: aError } = await supabase
    .from("assignment")
    .update({ status: "CONFIRMED" as AssignmentStatus })
    .eq("id", assignmentId);
  if (aError) return { success: false, error: aError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function createAssignment(
  massTimeId: string,
  ministerId: string,
  role: MinisterRole,
  readingLabel?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  let dbRole: string = role;
  if (role === "LECTOR") {
    const { data: existing } = await supabase
      .from("assignment")
      .select("role")
      .eq("mass_time_id", massTimeId)
      .in("role", ["LECTOR_1", "LECTOR_2"]);
    const usedRoles = new Set((existing ?? []).map((a: { role: string }) => a.role));
    dbRole = usedRoles.has("LECTOR_1") ? "LECTOR_2" : "LECTOR_1";
  }

  const { data, error } = await supabase
    .from("assignment")
    .insert({
      mass_time_id: massTimeId,
      minister_id: ministerId,
      role: dbRole,
      reading_label: readingLabel ?? null,
      status: "SCHEDULED",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true, id: data.id };
}

export async function createMultipleAssignments(
  massTimeId: string,
  ministerIds: string[],
  role: MinisterRole,
): Promise<{ success: boolean; error?: string }> {
  if (ministerIds.length === 0) return { success: true };
  const supabase = await createClient();

  let rows: { mass_time_id: string; minister_id: string; role: string; status: string; reading_label: null }[];

  if (role === "LECTOR") {
    const { data: existing } = await supabase
      .from("assignment")
      .select("role")
      .eq("mass_time_id", massTimeId)
      .in("role", ["LECTOR_1", "LECTOR_2"]);
    const usedRoles = new Set((existing ?? []).map((a: { role: string }) => a.role));
    const available = ["LECTOR_1", "LECTOR_2"].filter((r) => !usedRoles.has(r));
    rows = ministerIds.slice(0, available.length).map((ministerId, i) => ({
      mass_time_id: massTimeId,
      minister_id: ministerId,
      role: available[i],
      status: "SCHEDULED",
      reading_label: null,
    }));
  } else {
    rows = ministerIds.map((ministerId) => ({
      mass_time_id: massTimeId,
      minister_id: ministerId,
      role,
      status: "SCHEDULED",
      reading_label: null,
    }));
  }

  if (rows.length === 0) return { success: true };

  const { error } = await supabase.from("assignment").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignment")
    .delete()
    .eq("id", assignmentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateReadingLabel(
  assignmentId: string,
  readingLabel: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignment")
    .update({ reading_label: readingLabel })
    .eq("id", assignmentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ministers
// ---------------------------------------------------------------------------

export async function createMinister(formData: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  notification_preference: "email" | "sms" | "both" | "none";
  roles: MinisterRole[];
  notes?: string;
  priest_type?: PriestType;
  minister_diocese?: string;
  letter_of_suitability?: boolean;
  letter_expiration_date?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) return { success: false, error: pError.message };

  const { data, error } = await supabase
    .from("minister")
    .insert({ ...formData, parish_id: parish.id })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/ministers");
  return { success: true, id: data.id };
}

export async function updateMinister(
  id: string,
  updates: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    notification_preference: "email" | "sms" | "both" | "none";
    roles: MinisterRole[];
    is_active: boolean;
    notes: string;
    priest_type: PriestType | null;
    minister_diocese: string;
    letter_of_suitability: boolean;
    letter_expiration_date: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("minister")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ministers");
  revalidatePath("/", "layout");
  return { success: true };
}

export interface MinisterImportRow {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  notification_preference: "email" | "sms" | "both" | "none";
  roles: MinisterRole[];
  notes?: string;
  duplicate_id?: string;
  decision?: "skip" | "add" | "merge";
}

export async function bulkImportMinisters(
  rows: MinisterImportRow[]
): Promise<{ success: boolean; error?: string; added: number; merged: number; skipped: number }> {
  const supabase = createAdminClient();

  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) return { success: false, error: pError.message, added: 0, merged: 0, skipped: 0 };

  const cleanRows = rows.map((row) => ({
    ...row,
    first_name: row.first_name.trim(),
    last_name: row.last_name.trim(),
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    roles: Array.from(new Set(row.roles)),
    notification_preference: row.notification_preference ?? "email",
  }));

  let added = 0;
  let merged = 0;
  let skipped = 0;

  for (const row of cleanRows) {
    if (!row.first_name || !row.last_name) {
      skipped += 1;
      continue;
    }

    if (row.duplicate_id && row.decision === "merge") {
      const { data: existing, error: existingError } = await supabase
        .from("minister")
        .select("*")
        .eq("id", row.duplicate_id)
        .single();
      if (existingError) return { success: false, error: existingError.message, added, merged, skipped };

      const minister = existing as Minister;
      const mergedRoles = Array.from(new Set([...(minister.roles ?? []), ...row.roles]));
      const updates = {
        email: minister.email || row.email || null,
        phone: minister.phone || row.phone || null,
        notification_preference: minister.notification_preference || row.notification_preference,
        roles: mergedRoles,
        notes: minister.notes || row.notes || null,
      };

      const { error: updateError } = await supabase
        .from("minister")
        .update(updates)
        .eq("id", row.duplicate_id);
      if (updateError) return { success: false, error: updateError.message, added, merged, skipped };

      merged += 1;
      continue;
    }

    if (row.duplicate_id && row.decision !== "add") {
      skipped += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("minister").insert({
      parish_id: parish.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email ?? null,
      phone: row.phone ?? null,
      notification_preference: row.notification_preference,
      roles: row.roles,
      notes: row.notes ?? null,
      is_active: true,
    });
    if (insertError) return { success: false, error: insertError.message, added, merged, skipped };

    added += 1;
  }

  revalidatePath("/ministers");
  revalidatePath("/settings");
  return { success: true, added, merged, skipped };
}

// ---------------------------------------------------------------------------
// Mass Templates
// ---------------------------------------------------------------------------

export async function createTemplate(formData: {
  name: string;
  day_type: MassDayType;
  days_of_week?: number[];  // override for multi-day weekday templates
  start_time: string;
  language: MassLanguage;
  mass_type?: MassType;
  notes?: string;
  role_configs: { role: string; min_count: number; max_count: number }[];
}): Promise<{ success: boolean; error?: string; id?: string; generated?: { liturgicalDates: number; massTimes: number } }> {
  const supabase = await createClient();

  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) return { success: false, error: pError.message };

  const { day_type: dbDayType, day_of_week: defaultDow } = DAY_TYPE_TO_DB[formData.day_type];
  const dbDayOfWeek = formData.days_of_week ?? defaultDow;

  const { data: template, error: tError } = await supabase
    .from("mass_template")
    .insert({
      parish_id: parish.id,
      name: formData.name,
      day_type: dbDayType,
      day_of_week: dbDayOfWeek,
      start_time: formData.start_time,
      language: formData.language,
      mass_type: formData.mass_type ?? inferMassTypeForTemplate(formData.day_type, dbDayOfWeek, formData.start_time),
      notes: formData.notes ?? null,
    })
    .select("id")
    .single();

  if (tError) return { success: false, error: tError.message };

  // Insert role configs (skip roles with both min and max = 0)
  const roleRows = formData.role_configs
    .filter((rc) => rc.min_count > 0 || rc.max_count > 0)
    .map((rc) => ({
      template_id: template.id,
      role: rc.role,
      min_count: rc.min_count,
      max_count: rc.max_count,
    }));

  if (roleRows.length > 0) {
    const { error: rcError } = await supabase
      .from("mass_template_role")
      .insert(roleRows);
    if (rcError) return { success: false, error: rcError.message };
  }

  // Generate calendar records for the next 12 months
  const adminClient = createAdminClient();
  const genResult = await generateMassTimesForTemplate(adminClient, template.id, parish.id);

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return {
    success: true,
    id: template.id,
    generated: {
      liturgicalDates: genResult.liturgicalDatesCreated,
      massTimes: genResult.massTimesCreated + genResult.massTimesLinked,
    },
  };
}

export async function updateTemplate(
  id: string,
  formData: {
    name: string;
    day_type: MassDayType;
    days_of_week?: number[];  // override for multi-day weekday templates
    start_time: string;
    language: MassLanguage;
    mass_type?: MassType;
    notes?: string;
    role_configs: { role: string; min_count: number; max_count: number }[];
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Read existing template to detect changes that need propagation
  const { data: existing } = await supabase
    .from("mass_template")
    .select("start_time, language, mass_type")
    .eq("id", id)
    .single();

  const { day_type: dbDayType, day_of_week: defaultDow } = DAY_TYPE_TO_DB[formData.day_type];
  const dbDayOfWeek = formData.days_of_week ?? defaultDow;

  const { error: tError } = await supabase
    .from("mass_template")
    .update({
      name: formData.name,
      day_type: dbDayType,
      day_of_week: dbDayOfWeek,
      start_time: formData.start_time,
      language: formData.language,
      mass_type: formData.mass_type ?? inferMassTypeForTemplate(formData.day_type, dbDayOfWeek, formData.start_time),
      notes: formData.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (tError) return { success: false, error: tError.message };

  // Replace all role configs
  await supabase.from("mass_template_role").delete().eq("template_id", id);

  const roleRows = formData.role_configs
    .filter((rc) => rc.min_count > 0 || rc.max_count > 0)
    .map((rc) => ({
      template_id: id,
      role: rc.role,
      min_count: rc.min_count,
      max_count: rc.max_count,
    }));

  if (roleRows.length > 0) {
    const { error: rcError } = await supabase
      .from("mass_template_role")
      .insert(roleRows);
    if (rcError) return { success: false, error: rcError.message };
  }

  // Propagate start_time and/or language changes to future linked mass_times
  if (existing) {
    const nextMassType = formData.mass_type ?? inferMassTypeForTemplate(formData.day_type, dbDayOfWeek, formData.start_time);
    const propagationUpdates: { start_time?: string; language?: MassLanguage; mass_type?: MassType } = {};
    if (existing.start_time !== formData.start_time) propagationUpdates.start_time = formData.start_time;
    if (existing.language !== formData.language) propagationUpdates.language = formData.language;
    if ((existing as { mass_type?: MassType }).mass_type !== nextMassType) propagationUpdates.mass_type = nextMassType;

    if (Object.keys(propagationUpdates).length > 0) {
      const adminClient = createAdminClient();
      await propagateTemplateUpdates(adminClient, id, propagationUpdates);
    }
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // Clean up future mass_times: unlink staffed, delete unstaffed
  const adminClient = createAdminClient();
  await smartDeleteTemplateMasses(adminClient, id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("mass_template")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Calendar exceptions
// ---------------------------------------------------------------------------

export async function createOneOffMass(
  formData: FormData
): Promise<void> {
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const language = String(formData.get("language") ?? "ENGLISH") as MassLanguage;
  const massType = String(formData.get("mass_type") ?? inferMassTypeForDateTime(date, startTime)) as MassType;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error("A valid date and time are required.");
  }

  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) throw new Error(pError.message);

  const { data: existingLitDate, error: existingLdError } = await supabase
    .from("liturgical_date")
    .select("id")
    .eq("parish_id", parish.id)
    .eq("date", date)
    .maybeSingle();
  if (existingLdError) throw new Error(existingLdError.message);

  const holyDayName = getHolyDayOfObligationName(date);
  let litDate = existingLitDate;
  if (!litDate) {
    const { data: insertedLitDate, error: ldError } = await supabase
      .from("liturgical_date")
      .insert({
          parish_id: parish.id,
          date,
          season: getLiturgicalSeason(date),
          is_high_feast: massType === "HOLY_DAY_OF_OBLIGATION" || !!holyDayName,
          is_holy_day_of_obligation: massType === "HOLY_DAY_OF_OBLIGATION" || isHolyDayOfObligation(date),
          feast_name: holyDayName,
          notes: null,
        })
      .select("id")
      .single();
    if (ldError) throw new Error(ldError.message);
    litDate = insertedLitDate;
  } else if (massType === "HOLY_DAY_OF_OBLIGATION") {
    const litDateUpdates: Record<string, string | boolean> = { is_high_feast: true };
    if (massType === "HOLY_DAY_OF_OBLIGATION") litDateUpdates.is_holy_day_of_obligation = true;
    if (holyDayName) litDateUpdates.feast_name = holyDayName;
    await supabase
      .from("liturgical_date")
      .update(litDateUpdates)
      .eq("id", litDate.id);
  }

  const timeLabel = formatTimeLabel(startTime);
  const massTypeLabel = MASS_TYPE_LABELS[massType] ?? "Special";
  const displayName = `${timeLabel} ${massTypeLabel}`;

  const { data: massTime, error: mtError } = await supabase
    .from("mass_time")
    .insert({
      liturgical_date_id: litDate.id,
      time_label: timeLabel,
      display_name: displayName,
      sort_order: timeSortOrder(startTime),
      is_special: !["DAILY_MASS", "SUNDAY_MASS", "SATURDAY_VIGIL"].includes(massType),
      template_id: null,
      language,
      status: "SCHEDULED",
      mass_type: massType,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (mtError) throw new Error(mtError.message);

  const roleRows = ROLE_DISPLAY_ORDER.map((role) => {
    const min = Number(formData.get(`role_${role}_min`) ?? 0);
    const max = Number(formData.get(`role_${role}_max`) ?? min);
    return {
      mass_time_id: massTime.id,
      role,
      min_count: Number.isFinite(min) ? Math.max(0, min) : 0,
      max_count: Number.isFinite(max) ? Math.max(0, max) : 0,
    };
  }).filter((rc) => rc.min_count > 0 || rc.max_count > 0);

  if (roleRows.length > 0) {
    const { error: rcError } = await supabase.from("mass_time_role").insert(roleRows);
    if (rcError) throw new Error(rcError.message);
  }

  revalidatePath(`/mass/${date}`);
  revalidatePath("/", "layout");
}

export async function setMassTimeStatus(
  massTimeId: string,
  date: string,
  status: MassStatus
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mass_time")
    .update({ status })
    .eq("id", massTimeId);
  if (error) throw new Error(error.message);

  revalidatePath(`/mass/${date}`);
  revalidatePath(`/mass/${date}/${massTimeId}`);
  revalidatePath("/", "layout");
}

export async function updateMassMetadata(
  formData: FormData
): Promise<void> {
  const supabase = await createClient();

  const massTimeId = String(formData.get("mass_time_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const massType = String(formData.get("mass_type") ?? "DAILY_MASS") as MassType;
  const notes = String(formData.get("notes") ?? "").trim();
  const tags = formData
    .getAll("mass_tags")
    .map(String)
    .filter((tag): tag is MassTag => MASS_TAG_OPTIONS.includes(tag as MassTag));

  if (!massTimeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("A valid Mass and date are required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("mass_time")
    .select("time_label")
    .eq("id", massTimeId)
    .single();
  if (existingError) throw new Error(existingError.message);

  const massTypeLabel = MASS_TYPE_LABELS[massType] ?? "Mass";
  const { error } = await supabase
    .from("mass_time")
    .update({
      mass_type: massType,
      mass_tags: tags,
      notes: notes || null,
      display_name: `${existing.time_label} ${massTypeLabel}`,
      is_special: !["DAILY_MASS", "SUNDAY_MASS", "SATURDAY_VIGIL"].includes(massType),
    })
    .eq("id", massTimeId);
  if (error) throw new Error(error.message);

  revalidatePath(`/mass/${date}`);
  revalidatePath(`/mass/${date}/${massTimeId}`);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Backfill existing mass_times to templates (admin utility)
// ---------------------------------------------------------------------------

export async function runBackfill(): Promise<{ success: boolean; linked?: number; error?: string }> {
  const supabase = await createClient();
  const { data: parish, error: pError } = await supabase.from("parish").select("id").single();
  if (pError) return { success: false, error: pError.message };

  const adminClient = createAdminClient();
  const linked = await backfillTemplateLinks(adminClient, parish.id);

  revalidatePath("/", "layout");
  return { success: true, linked };
}
