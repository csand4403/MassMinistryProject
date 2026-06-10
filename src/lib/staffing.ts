// ─────────────────────────────────────────────────────────────────────────────
// Staffing status logic
//
// The traffic-light system communicates readiness at a glance to coordinators.
// RED    → Priest is unassigned. Mass literally cannot proceed.
// YELLOW → Deacon unassigned, OR any ministry role has zero people.
// GREEN  → Priest + Deacon + at least one person in every ministry role.
// ─────────────────────────────────────────────────────────────────────────────

import type { Assignment, MinisterRole, StaffingStatus } from "@/types";

const MINISTRY_ROLES: MinisterRole[] = [
  "LECTOR",
  "PSALMIST",
  "EMHC",
  "USHER",
  "SECURITY",
];

/**
 * Normalize DB role values to the canonical TypeScript MinisterRole.
 * The legacy DB enum uses LECTOR_1/LECTOR_2; the app uses a unified LECTOR.
 */
export function normalizeRole(role: string): string {
  if (role === "LECTOR_1" || role === "LECTOR_2") return "LECTOR";
  return role;
}

/**
 * Compute the staffing status for a single Mass from its assignments.
 * Assignments whose status is ABSENT are excluded (they effectively mean
 * the slot is uncovered).
 */
export function computeStaffingStatus(
  assignments: Pick<Assignment, "role" | "status">[]
): StaffingStatus {
  // Only count assignments that are not marked absent
  const active = assignments.filter((a) => a.status !== "ABSENT");

  // Normalize legacy LECTOR_1/LECTOR_2 → LECTOR
  const roles = new Set(active.map((a) => normalizeRole(a.role)));

  // RED: no Priest assigned — Mass cannot proceed
  if (!roles.has("CELEBRANT")) return "RED";

  // YELLOW: Deacon missing
  if (!roles.has("DEACON")) return "YELLOW";

  // YELLOW: any ministry role with zero coverage
  for (const role of MINISTRY_ROLES) {
    if (!roles.has(role)) return "YELLOW";
  }

  return "GREEN";
}

/**
 * Compute the worst-case staffing status across multiple Mass times.
 * Used for the calendar day-level summary dot.
 * Priority: RED > YELLOW > GREEN
 */
export function computeDayStatus(
  massStatuses: StaffingStatus[]
): StaffingStatus {
  if (massStatuses.includes("RED")) return "RED";
  if (massStatuses.includes("YELLOW")) return "YELLOW";
  if (massStatuses.length === 0) return "RED"; // no masses at all is effectively red
  return "GREEN";
}

/** Tailwind classes for each status indicator dot */
export const STATUS_DOT_CLASSES: Record<StaffingStatus, string> = {
  RED: "bg-red-500",
  YELLOW: "bg-yellow-400",
  GREEN: "bg-green-500",
};

/** Human-readable label for each status — used in tooltips and badges */
export const STATUS_LABELS: Record<StaffingStatus, string> = {
  RED: "Critical — Act Now",
  YELLOW: "Needs Attention",
  GREEN: "All Set",
};

/** Tailwind text color for each status */
export const STATUS_TEXT_CLASSES: Record<StaffingStatus, string> = {
  RED: "text-red-600",
  YELLOW: "text-yellow-600",
  GREEN: "text-green-600",
};

/** Tailwind background badge color for each status */
export const STATUS_BADGE_CLASSES: Record<StaffingStatus, string> = {
  RED: "bg-red-100 text-red-700 ring-red-300",
  YELLOW: "bg-yellow-50 text-yellow-700 ring-yellow-300",
  GREEN: "bg-green-100 text-green-700 ring-green-300",
};
