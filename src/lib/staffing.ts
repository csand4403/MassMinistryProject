// ─────────────────────────────────────────────────────────────────────────────
// Staffing status logic
//
// RED    → Priest is unassigned (or below required minimum).
// YELLOW → Any required role has fewer people than its minimum.
// GREEN  → All required minimums met.
//
// When a mass_time is linked to a template, per-role minimums from that
// template drive the logic. Otherwise the legacy defaults apply:
//   CELEBRANT ≥ 1, DEACON ≥ 1, all ministry roles ≥ 1.
// ─────────────────────────────────────────────────────────────────────────────

import type { Assignment, MinisterRole, StaffingStatus, MassTemplateRoleConfig, MassTimeRoleConfig } from "@/types";

const DEFAULT_MINISTRY_ROLES: MinisterRole[] = [
  "LECTOR",
  "PSALMIST",
  "EMHC",
  "USHER",
  "SECURITY",
];

export function normalizeRole(role: string): string {
  if (role === "LECTOR_1" || role === "LECTOR_2") return "LECTOR";
  return role;
}

/**
 * Compute staffing status for a single Mass from its assignments.
 * Pass `templateRoles` (from mass_template_role) to use template-defined
 * minimums; omit for the legacy fixed-role logic.
 */
export function computeStaffingStatus(
  assignments: Pick<Assignment, "role" | "status">[],
  templateRoles?: Pick<MassTemplateRoleConfig | MassTimeRoleConfig, "role" | "min_count">[]
): StaffingStatus {
  const active = assignments.filter((a) => a.status !== "ABSENT" && a.status !== "DECLINED");

  if (templateRoles && templateRoles.length > 0) {
    // Count active assignments per role
    const counts = new Map<string, number>();
    for (const a of active) {
      const r = normalizeRole(a.role);
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }

    // CELEBRANT must always be covered first (RED gate)
    const celebrantMin = templateRoles.find((r) => r.role === "CELEBRANT")?.min_count ?? 1;
    if ((counts.get("CELEBRANT") ?? 0) < celebrantMin) return "RED";

    // Check remaining roles with min_count > 0
    for (const cfg of templateRoles) {
      if (cfg.role === "CELEBRANT") continue;
      if (cfg.min_count > 0 && (counts.get(cfg.role) ?? 0) < cfg.min_count) {
        return "YELLOW";
      }
    }

    return "GREEN";
  }

  // Legacy default logic
  const roles = new Set(active.map((a) => normalizeRole(a.role)));
  if (!roles.has("CELEBRANT")) return "RED";
  if (!roles.has("DEACON")) return "YELLOW";
  for (const role of DEFAULT_MINISTRY_ROLES) {
    if (!roles.has(role)) return "YELLOW";
  }
  return "GREEN";
}

export function computeDayStatus(massStatuses: StaffingStatus[]): StaffingStatus {
  if (massStatuses.includes("RED")) return "RED";
  if (massStatuses.includes("YELLOW")) return "YELLOW";
  if (massStatuses.length === 0) return "RED";
  return "GREEN";
}

export const STATUS_DOT_CLASSES: Record<StaffingStatus, string> = {
  RED:    "bg-red-500",
  YELLOW: "bg-yellow-400",
  GREEN:  "bg-green-500",
};

export const STATUS_LABELS: Record<StaffingStatus, string> = {
  RED:    "Critical — Act Now",
  YELLOW: "Needs Attention",
  GREEN:  "All Set",
};

export const STATUS_TEXT_CLASSES: Record<StaffingStatus, string> = {
  RED:    "text-red-600",
  YELLOW: "text-yellow-600",
  GREEN:  "text-green-600",
};

export const STATUS_BADGE_CLASSES: Record<StaffingStatus, string> = {
  RED:    "bg-red-100 text-red-700 ring-red-300",
  YELLOW: "bg-yellow-50 text-yellow-700 ring-yellow-300",
  GREEN:  "bg-green-100 text-green-700 ring-green-300",
};
