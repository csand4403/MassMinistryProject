import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Assignment,
  MassLanguage,
  MassStatus,
  MassTemplateRoleConfig,
  MassTimeRoleConfig,
  MassType,
  StaffingStatus,
} from "@/types";
import { CELEBRATION_CATEGORY_LABELS, LANGUAGE_LABELS, MASS_TYPE_LABELS, categoryForMassType } from "@/types";
import { computeStaffingStatus, normalizeRole, STATUS_LABELS } from "@/lib/staffing";

export interface MassReportRow {
  id: string;
  date: string;
  time: string;
  type: MassType;
  typeLabel: string;
  language: MassLanguage;
  languageLabel: string;
  status: MassStatus;
  statusLabel: string;
  staffingStatus: StaffingStatus;
  staffingLabel: string;
  hasPriest: boolean;
  categoryLabel: string;
}

export interface MassReportSummary {
  totalCelebrated: number;
  cancelled: number;
  byType: { label: string; count: number }[];
  byLanguage: { label: string; count: number }[];
  unfilledCount: number;
  unfilledPercent: number;
  priestAssigned: number;
  priestUnassigned: number;
  priestCoveragePercent: number;
}

export interface MassReportData {
  rows: MassReportRow[];
  summary: MassReportSummary;
}

interface ReportMassTime {
  id: string;
  liturgical_date_id: string;
  time_label: string | null;
  display_name: string;
  sort_order: number;
  status: string;
  mass_type: string;
  celebration_category?: string | null;
  language: string;
  template_id: string | null;
}

export async function getMassReport(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<MassReportData> {
  const { data: litDates, error: ldError } = await supabase
    .from("liturgical_date")
    .select("id, date")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");
  if (ldError) throw ldError;
  if (!litDates || litDates.length === 0) return emptyReport();

  const liturgicalDateIds = litDates.map((date) => date.id);
  const dateById = new Map(litDates.map((date) => [date.id, date.date]));

  let massTimesSelect = "id, liturgical_date_id, time_label, display_name, sort_order, status, mass_type, celebration_category, language, template_id";
  let { data: massTimes, error: mtError } = await supabase
    .from("mass_time")
    .select(massTimesSelect)
    .in("liturgical_date_id", liturgicalDateIds)
    .order("sort_order");
  if (mtError && mtError.message?.includes("celebration_category")) {
    massTimesSelect = "id, liturgical_date_id, time_label, display_name, sort_order, status, mass_type, language, template_id";
    const fallback = await supabase
      .from("mass_time")
      .select(massTimesSelect)
      .in("liturgical_date_id", liturgicalDateIds)
      .order("sort_order");
    massTimes = fallback.data;
    mtError = fallback.error;
  }
  if (mtError) throw mtError;
  if (!massTimes || massTimes.length === 0) return emptyReport();
  const reportMassTimes = massTimes as unknown as ReportMassTime[];

  const massTimeIds = reportMassTimes.map((massTime) => massTime.id);
  const { data: assignments, error: aError } = await supabase
    .from("assignment")
    .select("mass_time_id, role, status")
    .in("mass_time_id", massTimeIds);
  if (aError) throw aError;

  const templateIds = Array.from(new Set(
    reportMassTimes.filter((massTime) => massTime.template_id).map((massTime) => massTime.template_id as string)
  ));
  const templateRoleMap = new Map<string, Pick<MassTemplateRoleConfig, "role" | "min_count">[]>();
  if (templateIds.length > 0) {
    const { data: roleConfigs } = await supabase
      .from("mass_template_role")
      .select("template_id, role, min_count")
      .in("template_id", templateIds);
    for (const config of roleConfigs ?? []) {
      if (!templateRoleMap.has(config.template_id)) templateRoleMap.set(config.template_id, []);
      templateRoleMap.get(config.template_id)!.push({ role: normalizeRole(config.role) as any, min_count: config.min_count });
    }
  }

  const oneOffIds = reportMassTimes.filter((massTime) => !massTime.template_id).map((massTime) => massTime.id);
  const massTimeRoleMap = new Map<string, Pick<MassTimeRoleConfig, "role" | "min_count">[]>();
  if (oneOffIds.length > 0) {
    const { data: roleConfigs } = await supabase
      .from("mass_time_role")
      .select("mass_time_id, role, min_count")
      .in("mass_time_id", oneOffIds);
    for (const config of roleConfigs ?? []) {
      if (!massTimeRoleMap.has(config.mass_time_id)) massTimeRoleMap.set(config.mass_time_id, []);
      massTimeRoleMap.get(config.mass_time_id)!.push({ role: normalizeRole(config.role) as any, min_count: config.min_count });
    }
  }

  const assignmentsByMass = new Map<string, Pick<Assignment, "role" | "status">[]>();
  for (const assignment of assignments ?? []) {
    if (!assignmentsByMass.has(assignment.mass_time_id)) assignmentsByMass.set(assignment.mass_time_id, []);
    assignmentsByMass.get(assignment.mass_time_id)!.push({
      role: normalizeRole(assignment.role) as Assignment["role"],
      status: assignment.status as Assignment["status"],
    });
  }

  const rows = reportMassTimes
    .map((massTime) => {
      const mtAssignments = assignmentsByMass.get(massTime.id) ?? [];
      const roleConfig = massTime.template_id
        ? templateRoleMap.get(massTime.template_id)
        : massTimeRoleMap.get(massTime.id);
      const staffingStatus = massTime.status === "CANCELLED"
        ? "GREEN"
        : computeStaffingStatus(mtAssignments, roleConfig);
      const hasPriest = mtAssignments.some((assignment) => assignment.status !== "ABSENT" && assignment.role === "CELEBRANT");

      const massType = massTime.mass_type as MassType;
      const category = (massTime.celebration_category ?? categoryForMassType(massType)) as keyof typeof CELEBRATION_CATEGORY_LABELS;

      return {
        id: massTime.id,
        date: dateById.get(massTime.liturgical_date_id) ?? "",
        time: massTime.time_label || massTime.display_name,
        type: massType,
        typeLabel: MASS_TYPE_LABELS[massType] ?? massTime.mass_type,
        language: massTime.language as MassLanguage,
        languageLabel: LANGUAGE_LABELS[massTime.language as MassLanguage] ?? massTime.language,
        status: massTime.status as MassStatus,
        statusLabel: massTime.status === "CANCELLED" ? "Cancelled" : "Scheduled",
        staffingStatus,
        staffingLabel: STATUS_LABELS[staffingStatus],
        hasPriest,
        categoryLabel: CELEBRATION_CATEGORY_LABELS[category] ?? "Mass",
      };
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  return { rows, summary: summarize(rows) };
}

function summarize(rows: MassReportRow[]): MassReportSummary {
  const activeRows = rows.filter((row) => row.status !== "CANCELLED");
  const typeCounts = countBy(activeRows, (row) => row.typeLabel);
  const languageCounts = countBy(activeRows, (row) => row.languageLabel);
  const unfilledCount = activeRows.filter((row) => row.staffingStatus !== "GREEN").length;
  const priestAssigned = activeRows.filter((row) => row.hasPriest).length;
  const priestUnassigned = activeRows.length - priestAssigned;

  return {
    totalCelebrated: activeRows.length,
    cancelled: rows.length - activeRows.length,
    byType: mapCounts(typeCounts),
    byLanguage: mapCounts(languageCounts),
    unfilledCount,
    unfilledPercent: percent(unfilledCount, activeRows.length),
    priestAssigned,
    priestUnassigned,
    priestCoveragePercent: percent(priestAssigned, activeRows.length),
  };
}

function countBy(rows: MassReportRow[], getKey: (row: MassReportRow) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(getKey(row), (counts.get(getKey(row)) ?? 0) + 1);
  return counts;
}

function mapCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function percent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function emptyReport(): MassReportData {
  return {
    rows: [],
    summary: {
      totalCelebrated: 0,
      cancelled: 0,
      byType: [],
      byLanguage: [],
      unfilledCount: 0,
      unfilledPercent: 0,
      priestAssigned: 0,
      priestUnassigned: 0,
      priestCoveragePercent: 0,
    },
  };
}
