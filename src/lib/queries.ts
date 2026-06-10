// ─────────────────────────────────────────────────────────────────────────────
// Supabase query helpers
// All data access goes through these functions to keep components clean.
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

/**
 * The legacy DB enum uses LECTOR_1/LECTOR_2; the app models both as LECTOR.
 * Normalize DB assignments before they reach any UI or logic layer.
 */
function normalizeAssignment<T extends { role: string }>(a: T): T {
  if (a.role === "LECTOR_1" || a.role === "LECTOR_2") {
    return { ...a, role: "LECTOR" };
  }
  return a;
}

// ---------------------------------------------------------------------------
// Parish
// ---------------------------------------------------------------------------

/** Always returns the first (and only) parish record. */
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

/**
 * Build the calendar grid data for a given month.
 * Returns one CalendarDayStatus entry per day in the month.
 * Sundays and feast days are "active" cells; all others are empty.
 */
export async function getCalendarMonth(
  supabase: SupabaseClient,
  year: number,
  month: number  // 1-based
): Promise<CalendarDayStatus[]> {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  // Fetch all liturgical dates for the month
  const { data: litDates, error: ldError } = await supabase
    .from("liturgical_date")
    .select("id, date, season, is_high_feast, is_holy_day_of_obligation, feast_name")
    .gte("date", startStr)
    .lte("date", endStr);
  if (ldError) throw ldError;

  // Build a map of date string → liturgical_date row
  const litDateMap = new Map<string, typeof litDates[0]>(
    (litDates ?? []).map((ld) => [ld.date, ld])
  );

  // For each liturgical date, fetch mass times and compute status
  const statusMap = new Map<string, StaffingStatus>();

  if (litDates && litDates.length > 0) {
    const litDateIds = litDates.map((ld) => ld.id);

    const { data: massTimes, error: mtError } = await supabase
      .from("mass_time")
      .select("id, liturgical_date_id")
      .in("liturgical_date_id", litDateIds);
    if (mtError) throw mtError;

    if (massTimes && massTimes.length > 0) {
      const massTimeIds = massTimes.map((mt) => mt.id);

      const { data: assignments, error: aError } = await supabase
        .from("assignment")
        .select("mass_time_id, role, status")
        .in("mass_time_id", massTimeIds);
      if (aError) throw aError;

      // Group assignments by mass_time_id
      const assignByMass = new Map<string, typeof assignments>();
      for (const a of assignments ?? []) {
        if (!assignByMass.has(a.mass_time_id)) {
          assignByMass.set(a.mass_time_id, []);
        }
        assignByMass.get(a.mass_time_id)!.push(a);
      }

      // Group mass times by liturgical_date_id
      const massTimesByDate = new Map<string, string[]>();
      for (const mt of massTimes) {
        if (!massTimesByDate.has(mt.liturgical_date_id)) {
          massTimesByDate.set(mt.liturgical_date_id, []);
        }
        massTimesByDate.get(mt.liturgical_date_id)!.push(mt.id);
      }

      // Compute status per liturgical date
      for (const ld of litDates) {
        const mtIds = massTimesByDate.get(ld.id) ?? [];
        const massStatuses: StaffingStatus[] = mtIds.map((mtId) => {
          const asgns = assignByMass.get(mtId) ?? [];
          return computeStaffingStatus(asgns as any);
        });
        statusMap.set(ld.date, computeDayStatus(massStatuses));
      }
    }
  }

  // Generate every day of the month
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
      status: isActive ? (statusMap.get(dateStr) ?? "RED") : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Liturgical Date
// ---------------------------------------------------------------------------

export async function getLiturgicalDate(
  supabase: SupabaseClient,
  date: string  // "YYYY-MM-DD"
): Promise<LiturgicalDate | null> {
  const { data, error } = await supabase
    .from("liturgical_date")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Get a liturgical date with all mass times and their full rosters.
 * This is the main query for the Mass Day View.
 */
export async function getLiturgicalDateWithMasses(
  supabase: SupabaseClient,
  date: string
): Promise<LiturgicalDateWithMasses | null> {
  const litDate = await getLiturgicalDate(supabase, date);
  if (!litDate) return null;

  const massTimes = await getMassTimesWithRosters(supabase, litDate.id);

  const overallStatus = computeDayStatus(massTimes.map((mt) => mt.staffing_status));

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

  // Fetch all assignments with minister details in one query
  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select(`
      *,
      minister (*)
    `)
    .in("mass_time_id", massTimeIds);
  if (aError) throw aError;

  const assignByMass = new Map<string, (Assignment & { minister: Minister })[]>();
  for (const mt of massTimes) {
    assignByMass.set(mt.id, []);
  }
  for (const a of assignments ?? []) {
    assignByMass.get(a.mass_time_id)?.push(a);
  }

  return massTimes.map((mt: MassTime) => {
    const mtAssignments = (assignByMass.get(mt.id) ?? []).map(normalizeAssignment);
    return {
      ...mt,
      assignments: mtAssignments,
      staffing_status: computeStaffingStatus(mtAssignments),
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
  return {
    ...mt,
    assignments: normalized,
    staffing_status: computeStaffingStatus(normalized),
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

/** Ministers qualified for a specific role */
export async function getMinistersForRole(
  supabase: SupabaseClient,
  role: string
): Promise<Minister[]> {
  // The DB enum uses LECTOR_1/LECTOR_2 for the unified LECTOR role.
  // Querying with "LECTOR" directly causes a 22P02 enum cast error.
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
// Upcoming staffing alerts — used for the dashboard banner
// ---------------------------------------------------------------------------

/**
 * Returns upcoming Mass times (next 4 weeks) with RED or YELLOW staffing status.
 * RED (missing Priest) entries sort first, then chronologically.
 */
export async function getUpcomingAlerts(
  supabase: SupabaseClient
): Promise<StaffingAlert[]> {
  const today = new Date();
  const lookAhead = addDays(today, 28);

  const startStr = format(today, "yyyy-MM-dd");
  const endStr = format(lookAhead, "yyyy-MM-dd");

  const { data: litDates, error: ldError } = await supabase
    .from("liturgical_date")
    .select("id, date")
    .gte("date", startStr)
    .lte("date", endStr);
  if (ldError) throw ldError;
  if (!litDates || litDates.length === 0) return [];

  const litDateIds = litDates.map((ld) => ld.id);

  const { data: massTimes, error: mtError } = await supabase
    .from("mass_time")
    .select("id, liturgical_date_id, time_label, display_name")
    .in("liturgical_date_id", litDateIds)
    .order("sort_order");
  if (mtError) throw mtError;
  if (!massTimes || massTimes.length === 0) return [];

  const massTimeIds = massTimes.map((mt) => mt.id);

  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select("mass_time_id, role, status")
    .in("mass_time_id", massTimeIds);
  if (aError) throw aError;

  // Group assignments by mass_time_id
  const assignByMass = new Map<string, { role: string; status: string }[]>();
  for (const a of assignments ?? []) {
    if (!assignByMass.has(a.mass_time_id)) assignByMass.set(a.mass_time_id, []);
    assignByMass.get(a.mass_time_id)!.push(a);
  }

  const dateByLitId = new Map(litDates.map((ld) => [ld.id, ld.date]));

  const alerts: StaffingAlert[] = [];

  for (const mt of massTimes) {
    const mtAssignments = assignByMass.get(mt.id) ?? [];
    const status = computeStaffingStatus(
      mtAssignments as Pick<Assignment, "role" | "status">[]
    );

    if (status === "RED" || status === "YELLOW") {
      const date = dateByLitId.get(mt.liturgical_date_id)!;
      const activeRoles = new Set(
        mtAssignments
          .filter((a) => a.status !== "ABSENT")
          .map((a) => a.role)
      );
      alerts.push({
        date,
        mass_time_id: mt.id,
        time_label: mt.time_label,
        display_name: mt.display_name,
        status,
        missing_priest: !activeRoles.has("CELEBRANT"),
      });
    }
  }

  // RED before YELLOW, then chronologically
  alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === "RED" ? -1 : 1;
    return a.date.localeCompare(b.date);
  });

  return alerts;
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
