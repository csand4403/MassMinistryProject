// ─────────────────────────────────────────────────────────────────────────────
// MassMinistry — Core TypeScript Types
// These mirror the Supabase database schema 1:1 so we get full type safety
// throughout the application.
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Role enum
// The canonical list of ministerial roles at each Mass.
// CELEBRANT is the only hard-required role — no Priest means no Mass.
// ---------------------------------------------------------------------------
export type MinisterRole =
  | "CELEBRANT"   // Ordained priest; hard required
  | "DEACON"      // Strongly expected on Sundays; not blocking
  | "LECTOR"      // Proclaims the readings; two slots per Mass
  | "PSALMIST"    // Leads the Responsorial Psalm (cantor/reader)
  | "EMHC"        // Extraordinary Minister of Holy Communion (multi-slot)
  | "USHER"       // Hospitality and collection ministry (multi-slot)
  | "SECURITY";   // On-site safety ministry (required at this parish)

// Display labels for each role — used in UI rendering
export const ROLE_LABELS: Record<MinisterRole, string> = {
  CELEBRANT: "Priest",
  DEACON: "Deacon",
  LECTOR: "Lector",
  PSALMIST: "Psalmist / Cantor",
  EMHC: "Extraordinary Minister of Holy Communion",
  USHER: "Usher",
  SECURITY: "Security",
};

// Short labels for compact display (e.g. calendar cards)
export const ROLE_SHORT_LABELS: Record<MinisterRole, string> = {
  CELEBRANT: "Priest",
  DEACON: "Deacon",
  LECTOR: "Lector",
  PSALMIST: "Psalmist",
  EMHC: "EMHC",
  USHER: "Usher",
  SECURITY: "Security",
};

// The canonical display order of roles in the Mass Detail roster view
// Liturgical order: Priest, Deacon, Lectors, Psalmist, EMHCs, Ushers, Security
export const ROLE_DISPLAY_ORDER: MinisterRole[] = [
  "CELEBRANT",
  "DEACON",
  "LECTOR",
  "PSALMIST",
  "EMHC",
  "USHER",
  "SECURITY",
];

// Roles that support multiple simultaneous assignments (multi-slot)
// LECTOR has two slots per Mass (first and second readings).
export const MULTI_SLOT_ROLES: MinisterRole[] = ["LECTOR", "EMHC", "USHER", "SECURITY"];

// ---------------------------------------------------------------------------
// Liturgical Season
// ---------------------------------------------------------------------------
export type LiturgicalSeason =
  | "ADVENT"
  | "CHRISTMAS"
  | "ORDINARY_TIME"
  | "LENT"
  | "EASTER_TRIDUUM"
  | "EASTER";

export const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  ADVENT: "Advent",
  CHRISTMAS: "Christmastide",
  ORDINARY_TIME: "Ordinary Time",
  LENT: "Lent",
  EASTER_TRIDUUM: "Easter Triduum",
  EASTER: "Eastertide",
};

// Tailwind color token for each liturgical season (border/accent strip)
export const SEASON_COLORS: Record<LiturgicalSeason, string> = {
  ADVENT: "bg-violet-700",
  CHRISTMAS: "bg-yellow-500",
  ORDINARY_TIME: "bg-green-700",
  LENT: "bg-purple-700",
  EASTER_TRIDUUM: "bg-red-800",
  EASTER: "bg-yellow-400",
};

// ---------------------------------------------------------------------------
// Assignment status
// ---------------------------------------------------------------------------
export type AssignmentStatus =
  | "SCHEDULED"    // Minister is assigned, not yet confirmed
  | "CONFIRMED"    // Minister has confirmed attendance
  | "CHECKED_IN"   // Minister has physically arrived; logged at door
  | "ABSENT";      // Minister did not show up

// ---------------------------------------------------------------------------
// Staffing status — drives the red/yellow/green indicator system
// ---------------------------------------------------------------------------
export type StaffingStatus = "RED" | "YELLOW" | "GREEN";

// ---------------------------------------------------------------------------
// Database row types
// These match the Supabase table structures exactly.
// ---------------------------------------------------------------------------

export interface Parish {
  id: string;
  name: string;
  diocese: string;
  timezone: string;
  created_at: string;
}

export interface LiturgicalDate {
  id: string;
  parish_id: string;
  date: string;                        // ISO date: "YYYY-MM-DD"
  season: LiturgicalSeason;
  is_high_feast: boolean;
  is_holy_day_of_obligation: boolean;
  feast_name: string | null;           // e.g. "The Nativity of the Lord"
  notes: string | null;
  created_at: string;
}

export interface MassTime {
  id: string;
  liturgical_date_id: string;
  time_label: string;                  // e.g. "8:00 AM"
  display_name: string;                // e.g. "Sunday Morning Mass"
  sort_order: number;                  // for consistent ordering
  is_special: boolean;                 // true if added/modified for a feast
  created_at: string;
}

export interface Minister {
  id: string;
  parish_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notification_preference: "email" | "sms" | "both" | "none";
  roles: MinisterRole[];               // roles this minister is qualified for
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  mass_time_id: string;
  minister_id: string;
  role: MinisterRole;
  reading_label: string | null;        // legacy field; kept for DB compatibility
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  // Joined fields (not in DB, populated by queries)
  minister?: Minister;
  mass_time?: MassTime;
}

export interface CheckIn {
  id: string;
  assignment_id: string;
  checked_in_at: string;               // ISO timestamp
  checked_in_by: string;               // coordinator name or "self"
  created_at: string;
}

// ---------------------------------------------------------------------------
// Composite / View types — assembled by query helpers
// ---------------------------------------------------------------------------

// A MassTime with its full roster of assignments
export interface MassTimeWithRoster extends MassTime {
  assignments: (Assignment & { minister: Minister })[];
  staffing_status: StaffingStatus;
}

// A LiturgicalDate with all its mass times and rosters
export interface LiturgicalDateWithMasses extends LiturgicalDate {
  mass_times: MassTimeWithRoster[];
  overall_status: StaffingStatus;      // worst status across all mass times
}

// Calendar cell data — lightweight, just enough for the grid
export interface CalendarDayStatus {
  date: string;                        // "YYYY-MM-DD"
  liturgical_date_id: string | null;
  is_sunday: boolean;
  is_feast_or_holy_day: boolean;
  feast_name: string | null;
  is_holy_day_of_obligation: boolean;
  season: LiturgicalSeason | null;
  status: StaffingStatus | null;       // null if not a liturgical day
}

// An upcoming staffing alert — used in the dashboard banner
export interface StaffingAlert {
  date: string;                        // "YYYY-MM-DD"
  mass_time_id: string;
  time_label: string;
  display_name: string;
  status: StaffingStatus;
  missing_priest: boolean;
}
