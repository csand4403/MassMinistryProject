// ─────────────────────────────────────────────────────────────────────────────
// Supabase query helpers
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LiturgicalDate,
  MassTime,
  Minister,
  Assignment,
  CheckIn,
  MassTimeWithRoster,
  LiturgicalDateWithMasses,
  CalendarDayStatus,
  StaffingStatus,
  StaffingAlert,
  CelebrantAlert,
  MassTemplate,
  MassTemplateRoleConfig,
  MassTimeRoleConfig,
  MassLanguage,
} from "@/types";
import { computeStaffingStatus, computeDayStatus, normalizeRole } from "./staffing";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSunday,
  format,
  addDays,
} from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAssignment<T extends { role: string }>(a: T): T {
  if (a.role === "LECTOR_1" || a.role === "LECTOR_2") {
    return { ...a, role: "LECTOR" };
  }
  return a;
}

function normalizeMinisterRoles<T extends { roles: string[] }>(m: T): T {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const r of m.roles) {
    const normalized = normalizeRole(r);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(normalized);
    }
  }
  return { ...m, roles: deduped as T["roles"] };
}

// ---------------------------------------------------------------------------
// Parish
// ---------------------------------------------------------------------------

export async function getParish(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("parish")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function getCalendarMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<CalendarDayStatus[]> {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const { data: litDates, error: ldError } = await supabase
    .from("liturgical_date")
    .select("id, date, season, is_high_feast, is_holy_day_of_obligation, feast_name")
    .gte("date", startStr)
    .lte("date", endStr);
  if (ldError) throw ldError;

  const litDateMap = new Map<string, typeof litDates[0]>(
    (litDates ?? []).map((ld) => [ld.date, ld])
  );

  const statusMap = new Map<string, StaffingStatus>();
  const languageMap = new Map<string, MassLanguage[]>(); // date → languages
  const cancelledMap = new Map<string, boolean>();

  if (litDates && litDates.length > 0) {
    const litDateIds = litDates.map((ld) => ld.id);

    // Try to fetch with Phase 2A columns (template_id, language).
    // Falls back to base columns if migration hasn't been applied yet.
    let massTimes: { id: string; liturgical_date_id: string; template_id?: string | null; language?: string | null; status?: string | null }[] | null = null;
    {
      const { data, error } = await supabase
        .from("mass_time")
        .select("id, liturgical_date_id, template_id, language, status")
        .in("liturgical_date_id", litDateIds);
      if (!error) {
        massTimes = data;
      } else {
        // Migration not yet applied — fall back to base columns
        const { data: fallback, error: fbError } = await supabase
          .from("mass_time")
          .select("id, liturgical_date_id")
          .in("liturgical_date_id", litDateIds);
        if (fbError) throw fbError;
        massTimes = fallback;
      }
    }

    if (massTimes && massTimes.length > 0) {
      const massTimeIds = massTimes.map((mt) => mt.id);

      // Fetch assignments
      const { data: assignments, error: aError } = await supabase
        .from("assignment")
        .select("mass_time_id, role, status")
        .in("mass_time_id", massTimeIds);
      if (aError) throw aError;

      // Fetch template role configs for linked templates (Phase 2A)
      const templateIds = Array.from(new Set(
        massTimes.filter((mt) => mt.template_id && mt.status !== "CANCELLED").map((mt) => mt.template_id as string)
      ));

      const templateRoleMap = new Map<string, Pick<MassTemplateRoleConfig, "role" | "min_count">[]>();
      if (templateIds.length > 0) {
        const { data: roleConfigs } = await supabase
          .from("mass_template_role")
          .select("template_id, role, min_count")
          .in("template_id", templateIds);
        for (const rc of roleConfigs ?? []) {
          if (!templateRoleMap.has(rc.template_id)) templateRoleMap.set(rc.template_id, []);
          templateRoleMap.get(rc.template_id)!.push({ role: rc.role, min_count: rc.min_count });
        }
      }

      const oneOffIds = massTimes
        .filter((mt) => !mt.template_id && mt.status !== "CANCELLED")
        .map((mt) => mt.id);
      const massTimeRoleMap = new Map<string, Pick<MassTimeRoleConfig, "role" | "min_count">[]>();
      if (oneOffIds.length > 0) {
        const { data: roleConfigs } = await supabase
          .from("mass_time_role")
          .select("mass_time_id, role, min_count")
          .in("mass_time_id", oneOffIds);
        for (const rc of roleConfigs ?? []) {
          if (!massTimeRoleMap.has(rc.mass_time_id)) massTimeRoleMap.set(rc.mass_time_id, []);
          massTimeRoleMap.get(rc.mass_time_id)!.push({ role: rc.role, min_count: rc.min_count });
        }
      }

      // Group assignments by mass_time_id
      const assignByMass = new Map<string, typeof assignments>();
      for (const a of assignments ?? []) {
        if (!assignByMass.has(a.mass_time_id)) {
          assignByMass.set(a.mass_time_id, []);
        }
        assignByMass.get(a.mass_time_id)!.push(a);
      }

      // Group mass times by liturgical_date_id
      const massTimesByDate = new Map<string, typeof massTimes>();
      for (const mt of massTimes) {
        if (!massTimesByDate.has(mt.liturgical_date_id)) {
          massTimesByDate.set(mt.liturgical_date_id, []);
        }
        massTimesByDate.get(mt.liturgical_date_id)!.push(mt);
      }

      for (const ld of litDates) {
        const mts = massTimesByDate.get(ld.id) ?? [];
        const activeMts = mts.filter((mt) => mt.status !== "CANCELLED");
        if (mts.some((mt) => mt.status === "CANCELLED")) {
          cancelledMap.set(ld.date, true);
        }

        // Collect languages for this date
        const langs: MassLanguage[] = [];
        for (const mt of activeMts) {
          if (mt.language && !langs.includes(mt.language as MassLanguage)) {
            langs.push(mt.language as MassLanguage);
          }
        }
        if (langs.length > 0) languageMap.set(ld.date, langs);

        const massStatuses: StaffingStatus[] = activeMts.map((mt) => {
          const asgns = assignByMass.get(mt.id) ?? [];
          const templateRoles = mt.template_id
            ? templateRoleMap.get(mt.template_id)
            : massTimeRoleMap.get(mt.id);
          return computeStaffingStatus(asgns as any, templateRoles);
        });
        if (massStatuses.length > 0) {
          statusMap.set(ld.date, computeDayStatus(massStatuses));
        }
      }
    }
  }

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const litDate = litDateMap.get(dateStr);
    const sunday = isSunday(day);
    const isActive = sunday || !!litDate;

    return {
      date: dateStr,
      liturgical_date_id: litDate?.id ?? null,
      is_sunday: sunday,
      is_feast_or_holy_day: litDate?.is_high_feast || litDate?.is_holy_day_of_obligation || false,
      feast_name: litDate?.feast_name ?? null,
      is_holy_day_of_obligation: litDate?.is_holy_day_of_obligation ?? false,
      season: litDate?.season ?? null,
      status: isActive ? (statusMap.get(dateStr) ?? (cancelledMap.get(dateStr) ? null : "RED")) : null,
      languages: isActive ? (languageMap.get(dateStr) ?? []) : [],
      has_cancelled_mass: cancelledMap.get(dateStr) ?? false,
    };
  });
}

// ---------------------------------------------------------------------------
// Liturgical Date
// ---------------------------------------------------------------------------

export async function getLiturgicalDate(
  supabase: SupabaseClient,
  date: string
): Promise<LiturgicalDate | null> {
  const { data, error } = await supabase
    .from("liturgical_date")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLiturgicalDateWithMasses(
  supabase: SupabaseClient,
  date: string
): Promise<LiturgicalDateWithMasses | null> {
  const litDate = await getLiturgicalDate(supabase, date);
  if (!litDate) return null;

  const massTimes = await getMassTimesWithRosters(supabase, litDate.id);
  const activeMassTimes = massTimes.filter((mt) => mt.status !== "CANCELLED");
  const overallStatus = computeDayStatus(activeMassTimes.map((mt) => mt.staffing_status));

  return {
    ...litDate,
    mass_times: massTimes,
    overall_status: overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Mass Times
// ---------------------------------------------------------------------------

export async function getMassTimesWithRosters(
  supabase: SupabaseClient,
  liturgicalDateId: string
): Promise<MassTimeWithRoster[]> {
  const { data: massTimes, error: mtError } = await supabase
    .from("mass_time")
    .select("*")
    .eq("liturgical_date_id", liturgicalDateId)
    .order("sort_order");
  if (mtError) throw mtError;
  if (!massTimes || massTimes.length === 0) return [];

  const massTimeIds = massTimes.map((mt: MassTime) => mt.id);

  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select(`*, minister (*)`)
    .in("mass_time_id", massTimeIds);
  if (aError) throw aError;

  // Fetch templates for linked mass times
  const templateIds = Array.from(new Set(
    massTimes.filter((mt: MassTime) => mt.template_id).map((mt: MassTime) => mt.template_id as string)
  ));

  const templateMap = new Map<string, MassTemplate>();
  if (templateIds.length > 0) {
    const { data: templates } = await supabase
      .from("mass_template")
      .select("*, mass_template_role(*)")
      .in("id", templateIds);
    for (const t of templates ?? []) {
      templateMap.set(t.id, {
        ...t,
        role_configs: t.mass_template_role ?? [],
      });
    }
  }

  const { data: massTimeRoles } = await supabase
    .from("mass_time_role")
    .select("*")
    .in("mass_time_id", massTimeIds);

  const roleConfigByMass = new Map<string, MassTimeRoleConfig[]>();
  for (const rc of massTimeRoles ?? []) {
    if (!roleConfigByMass.has(rc.mass_time_id)) roleConfigByMass.set(rc.mass_time_id, []);
    roleConfigByMass.get(rc.mass_time_id)!.push(rc);
  }

  const assignByMass = new Map<string, (Assignment & { minister: Minister })[]>();
  for (const mt of massTimes) {
    assignByMass.set(mt.id, []);
  }
  for (const a of assignments ?? []) {
    assignByMass.get(a.mass_time_id)?.push(a);
  }

  return massTimes.map((mt: MassTime) => {
    const mtAssignments = (assignByMass.get(mt.id) ?? []).map(normalizeAssignment);
    const template = mt.template_id ? templateMap.get(mt.template_id) ?? null : null;
    const occurrenceRoles = roleConfigByMass.get(mt.id);
    const templateRoles = occurrenceRoles?.length ? occurrenceRoles : template?.role_configs?.map((rc) => ({
      role: rc.role,
      min_count: rc.min_count,
    }));
    return {
      ...mt,
      assignments: mtAssignments,
      staffing_status: mt.status === "CANCELLED" ? "GREEN" : computeStaffingStatus(mtAssignments, templateRoles),
      template,
      role_configs: occurrenceRoles ?? [],
    };
  });
}

export async function getMassTimeWithRoster(
  supabase: SupabaseClient,
  massTimeId: string
): Promise<MassTimeWithRoster | null> {
  const { data: mt, error: mtError } = await supabase
    .from("mass_time")
    .select("*")
    .eq("id", massTimeId)
    .single();
  if (mtError) throw mtError;

  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select(`*, minister (*)`)
    .eq("mass_time_id", massTimeId);
  if (aError) throw aError;

  const normalized = (assignments ?? []).map(normalizeAssignment);

  let template: MassTemplate | null = null;
  if (mt.template_id) {
    const { data: tmpl } = await supabase
      .from("mass_template")
      .select("*, mass_template_role(*)")
      .eq("id", mt.template_id)
      .single();
    if (tmpl) template = { ...tmpl, role_configs: tmpl.mass_template_role ?? [] };
  }

  const { data: occurrenceRoles } = await supabase
    .from("mass_time_role")
    .select("*")
    .eq("mass_time_id", massTimeId);

  const massTimeRoles = (occurrenceRoles ?? []) as MassTimeRoleConfig[];
  const templateRoles = massTimeRoles.length ? massTimeRoles : template?.role_configs?.map((rc) => ({
    role: rc.role,
    min_count: rc.min_count,
  }));

  return {
    ...mt,
    assignments: normalized,
    staffing_status: mt.status === "CANCELLED" ? "GREEN" : computeStaffingStatus(normalized, templateRoles),
    template,
    role_configs: massTimeRoles,
  };
}

// ---------------------------------------------------------------------------
// Ministers
// ---------------------------------------------------------------------------

export async function getMinisters(supabase: SupabaseClient): Promise<Minister[]> {
  const { data, error } = await supabase
    .from("minister")
    .select("*")
    .eq("is_active", true)
    .order("last_name")
    .order("first_name");
  if (error) throw error;
  return (data ?? []).map(normalizeMinisterRoles);
}

export async function getMinister(
  supabase: SupabaseClient,
  id: string
): Promise<Minister | null> {
  const { data, error } = await supabase
    .from("minister")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? normalizeMinisterRoles(data) : null;
}

export async function getMinistersForRole(
  supabase: SupabaseClient,
  role: string
): Promise<Minister[]> {
  if (role === "LECTOR") {
    const { data, error } = await supabase
      .from("minister")
      .select("*")
      .eq("is_active", true)
      .or('roles.cs.{"LECTOR_1"},roles.cs.{"LECTOR_2"}')
      .order("last_name");
    if (error) throw error;
    return (data ?? []).map((m: Minister) => ({
      ...m,
      roles: m.roles.map((r: string) => normalizeRole(r)) as Minister["roles"],
    }));
  }

  const { data, error } = await supabase
    .from("minister")
    .select("*")
    .eq("is_active", true)
    .contains("roles", [role])
    .order("last_name");
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Mass Templates
// ---------------------------------------------------------------------------

export async function getTemplates(supabase: SupabaseClient): Promise<MassTemplate[]> {
  const { data, error } = await supabase
    .from("mass_template")
    .select("*, mass_template_role(*)")
    .order("day_type")
    .order("start_time");
  // Table may not exist if migration hasn't run yet
  if (error) return [];
  return (data ?? []).map((t) => ({ ...t, role_configs: t.mass_template_role ?? [] }));
}

export async function getTemplate(
  supabase: SupabaseClient,
  id: string
): Promise<MassTemplate | null> {
  const { data, error } = await supabase
    .from("mass_template")
    .select("*, mass_template_role(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  if (!data) return null;
  return { ...data, role_configs: data.mass_template_role ?? [] };
}

// ---------------------------------------------------------------------------
// Upcoming staffing alerts — dashboard banner
// ---------------------------------------------------------------------------

export async function getUpcomingAlerts(
  supabase: SupabaseClient
): Promise<{ staffing: StaffingAlert[]; celebrant: CelebrantAlert[] }> {
  const today = new Date();
  const lookAhead = addDays(today, 7);

  const startStr = format(today, "yyyy-MM-dd");
  const endStr = format(lookAhead, "yyyy-MM-dd");

  const { data: litDates, error: ldError } = await supabase
    .from("liturgical_date")
    .select("id, date")
    .gte("date", startStr)
    .lte("date", endStr);
  if (ldError) throw ldError;
  if (!litDates || litDates.length === 0) return { staffing: [], celebrant: [] };

  const litDateIds = litDates.map((ld) => ld.id);

  // Try with Phase 2A columns (template_id); fall back if migration not yet applied
  let massTimes: { id: string; liturgical_date_id: string; time_label: string; display_name: string; template_id?: string | null; status?: string | null }[] | null = null;
  {
    const { data, error } = await supabase
      .from("mass_time")
      .select("id, liturgical_date_id, time_label, display_name, template_id, status")
      .in("liturgical_date_id", litDateIds)
      .order("sort_order");
    if (!error) {
      massTimes = data;
    } else {
      const { data: fallback, error: fbError } = await supabase
        .from("mass_time")
        .select("id, liturgical_date_id, time_label, display_name")
        .in("liturgical_date_id", litDateIds)
        .order("sort_order");
      if (fbError) throw fbError;
      massTimes = fallback;
    }
  }
  if (!massTimes || massTimes.length === 0) return { staffing: [], celebrant: [] };
  massTimes = massTimes.filter((mt) => mt.status !== "CANCELLED");
  if (massTimes.length === 0) return { staffing: [], celebrant: [] };

  const massTimeIds = massTimes.map((mt) => mt.id);

  // Try with Phase 2A minister columns; fall back to base columns if not migrated
  let assignments: any[] | null = null;
  {
    const { data, error } = await supabase
      .from("assignment")
      .select("mass_time_id, role, status, minister_id, minister(id, first_name, last_name, priest_type, minister_diocese, letter_of_suitability, letter_expiration_date)")
      .in("mass_time_id", massTimeIds);
    if (!error) {
      assignments = data;
    } else {
      const { data: fallback, error: fbError } = await supabase
        .from("assignment")
        .select("mass_time_id, role, status, minister_id, minister(id, first_name, last_name)")
        .in("mass_time_id", massTimeIds);
      if (fbError) throw fbError;
      assignments = fallback;
    }
  }

  // Fetch template role configs
  const templateIds = Array.from(new Set(
    massTimes.filter((mt) => mt.template_id).map((mt) => mt.template_id as string)
  ));
  const templateRoleMap = new Map<string, Pick<MassTemplateRoleConfig, "role" | "min_count">[]>();
  if (templateIds.length > 0) {
    const { data: roleConfigs } = await supabase
      .from("mass_template_role")
      .select("template_id, role, min_count")
      .in("template_id", templateIds);
    for (const rc of roleConfigs ?? []) {
      if (!templateRoleMap.has(rc.template_id)) templateRoleMap.set(rc.template_id, []);
      templateRoleMap.get(rc.template_id)!.push({ role: rc.role, min_count: rc.min_count });
    }
  }

  const oneOffIds = massTimes.filter((mt) => !mt.template_id).map((mt) => mt.id);
  const massTimeRoleMap = new Map<string, Pick<MassTimeRoleConfig, "role" | "min_count">[]>();
  if (oneOffIds.length > 0) {
    const { data: roleConfigs } = await supabase
      .from("mass_time_role")
      .select("mass_time_id, role, min_count")
      .in("mass_time_id", oneOffIds);
    for (const rc of roleConfigs ?? []) {
      if (!massTimeRoleMap.has(rc.mass_time_id)) massTimeRoleMap.set(rc.mass_time_id, []);
      massTimeRoleMap.get(rc.mass_time_id)!.push({ role: rc.role, min_count: rc.min_count });
    }
  }

  const assignByMass = new Map<string, any[]>();
  for (const a of assignments ?? []) {
    if (!assignByMass.has(a.mass_time_id)) assignByMass.set(a.mass_time_id, []);
    assignByMass.get(a.mass_time_id)!.push(a);
  }

  const dateByLitId = new Map(litDates.map((ld) => [ld.id, ld.date]));

  const staffing: StaffingAlert[] = [];
  const celebrant: CelebrantAlert[] = [];
  const today8601 = format(today, "yyyy-MM-dd");

  for (const mt of massTimes) {
    const mtAssignments = assignByMass.get(mt.id) ?? [];
    const templateRoles = mt.template_id ? templateRoleMap.get(mt.template_id) : massTimeRoleMap.get(mt.id);
    const status = computeStaffingStatus(
      mtAssignments as Pick<Assignment, "role" | "status">[],
      templateRoles
    );

    const date = dateByLitId.get(mt.liturgical_date_id)!;

    if (status === "RED" || status === "YELLOW") {
      const activeRoles = new Set(
        mtAssignments.filter((a) => a.status !== "ABSENT").map((a) => a.role)
      );
      staffing.push({
        date,
        mass_time_id: mt.id,
        time_label: mt.time_label,
        display_name: mt.display_name,
        status,
        missing_priest: !activeRoles.has("CELEBRANT"),
      });
    }

    // Check for visiting celebrant letter warnings
    for (const a of mtAssignments) {
      if (a.status === "ABSENT") continue;
      if (a.role !== "CELEBRANT") continue;
      const m = a.minister;
      if (!m || m.priest_type !== "VISITING_CELEBRANT") continue;

      const isDallaDiocese = !m.minister_diocese || m.minister_diocese === "Diocese of Dallas";
      const letterMissing = !m.letter_of_suitability;
      const letterExpired =
        !isDallaDiocese &&
        m.letter_expiration_date != null &&
        m.letter_expiration_date < today8601;

      if (letterMissing) {
        celebrant.push({
          date,
          mass_time_id: mt.id,
          time_label: mt.time_label,
          display_name: mt.display_name,
          minister_name: `${m.first_name} ${m.last_name}`,
          warning: "missing_letter",
        });
      } else if (letterExpired) {
        celebrant.push({
          date,
          mass_time_id: mt.id,
          time_label: mt.time_label,
          display_name: mt.display_name,
          minister_name: `${m.first_name} ${m.last_name}`,
          warning: "expired_letter",
        });
      }
    }
  }

  staffing.sort((a, b) => {
    if (a.status !== b.status) return a.status === "RED" ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  celebrant.sort((a, b) => a.date.localeCompare(b.date));

  return { staffing, celebrant };
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function getCheckInsForMassTime(
  supabase: SupabaseClient,
  massTimeId: string
): Promise<CheckIn[]> {
  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select("id")
    .eq("mass_time_id", massTimeId);
  if (aError) throw aError;
  if (!assignments || assignments.length === 0) return [];

  const { data, error } = await supabase
    .from("check_in")
    .select("*")
    .in("assignment_id", assignments.map((a) => a.id));
  if (error) throw error;
  return data ?? [];
}
