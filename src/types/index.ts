// ─────────────────────────────────────────────────────────────────────────────
// MassMinistry — Core TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Role enum
// ---------------------------------------------------------------------------
export type MinisterRole =
  | "CELEBRANT"
  | "DEACON"
  | "LECTOR"
  | "PSALMIST"
  | "EMHC"
  | "USHER"
  | "ALTAR_SERVER"
  | "THURIFER"
  | "SECURITY";

export const ROLE_LABELS: Record<MinisterRole, string> = {
  CELEBRANT:    "Priest",
  DEACON:       "Deacon",
  LECTOR:       "Lector",
  PSALMIST:     "Psalmist / Cantor",
  EMHC:         "Extraordinary Minister of Holy Communion",
  USHER:        "Usher",
  ALTAR_SERVER: "Altar Server",
  THURIFER:     "Thurifer",
  SECURITY:     "Security",
};

export const ROLE_SHORT_LABELS: Record<MinisterRole, string> = {
  CELEBRANT:    "Priest",
  DEACON:       "Deacon",
  LECTOR:       "Lector",
  PSALMIST:     "Psalmist",
  EMHC:         "EMHC",
  USHER:        "Usher",
  ALTAR_SERVER: "Altar Server",
  THURIFER:     "Thurifer",
  SECURITY:     "Security",
};

export const ROLE_DISPLAY_ORDER: MinisterRole[] = [
  "CELEBRANT",
  "DEACON",
  "LECTOR",
  "PSALMIST",
  "EMHC",
  "USHER",
  "ALTAR_SERVER",
  "THURIFER",
  "SECURITY",
];

export const MULTI_SLOT_ROLES: MinisterRole[] = [
  "LECTOR",
  "EMHC",
  "USHER",
  "ALTAR_SERVER",
  "SECURITY",
];

// ---------------------------------------------------------------------------
// Mass Language
// ---------------------------------------------------------------------------
export type MassLanguage =
  | "ENGLISH"
  | "SPANISH"
  | "FRENCH"
  | "BILINGUAL_EN_ES"
  | "BILINGUAL_EN_FR";

export const LANGUAGE_LABELS: Record<MassLanguage, string> = {
  ENGLISH:          "English",
  SPANISH:          "Spanish",
  FRENCH:           "French",
  BILINGUAL_EN_ES:  "Bilingual English/Spanish",
  BILINGUAL_EN_FR:  "Bilingual English/French",
};

export const LANGUAGE_SHORT: Record<MassLanguage, string> = {
  ENGLISH:          "EN",
  SPANISH:          "ES",
  FRENCH:           "FR",
  BILINGUAL_EN_ES:  "EN/ES",
  BILINGUAL_EN_FR:  "EN/FR",
};

// ---------------------------------------------------------------------------
// Priest type
// ---------------------------------------------------------------------------
export type PriestType =
  | "PASTOR_ON_STAFF"
  | "ASSOCIATE_ON_STAFF"
  | "VISITING_CELEBRANT";

export const PRIEST_TYPE_LABELS: Record<PriestType, string> = {
  PASTOR_ON_STAFF:     "Pastor on Staff",
  ASSOCIATE_ON_STAFF:  "Associate on Staff",
  VISITING_CELEBRANT:  "Visiting Celebrant",
};

// ---------------------------------------------------------------------------
// Mass day type (for templates)
// UI-facing values; per-weekday types map to day_type='WEEKDAY' + day_of_week in DB.
// ---------------------------------------------------------------------------
export type MassDayType =
  | "SUNDAY"
  | "SATURDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "HOLY_DAY"
  | "SCHOOL_MASS";

export const DAY_TYPE_LABELS: Record<MassDayType, string> = {
  SUNDAY:      "Sunday",
  SATURDAY:    "Saturday",
  MONDAY:      "Monday",
  TUESDAY:     "Tuesday",
  WEDNESDAY:   "Wednesday",
  THURSDAY:    "Thursday",
  FRIDAY:      "Friday",
  HOLY_DAY:    "Holy Day",
  SCHOOL_MASS: "School Mass",
};

// Maps UI MassDayType → { db_day_type, day_of_week } stored in mass_template.
// day_of_week is now an array (migration 009) — single-day types map to a 1-element array.
export const DAY_TYPE_TO_DB: Record<MassDayType, { day_type: string; day_of_week: number[] | null }> = {
  SUNDAY:      { day_type: "SUNDAY",    day_of_week: null },
  SATURDAY:    { day_type: "WEEKDAY",   day_of_week: [6] },
  MONDAY:      { day_type: "WEEKDAY",   day_of_week: [1] },
  TUESDAY:     { day_type: "WEEKDAY",   day_of_week: [2] },
  WEDNESDAY:   { day_type: "WEEKDAY",   day_of_week: [3] },
  THURSDAY:    { day_type: "WEEKDAY",   day_of_week: [4] },
  FRIDAY:      { day_type: "WEEKDAY",   day_of_week: [5] },
  HOLY_DAY:    { day_type: "HOLY_DAY",  day_of_week: null },
  SCHOOL_MASS: { day_type: "SCHOOL_MASS", day_of_week: null },
};

// Normalise day_of_week — DB may return integer (pre-migration) or integer[] (post-migration).
export function normalizeDaysOfWeek(raw: number | number[] | null): number[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw;
  return [raw];
}

// Reverse: reconstruct UI MassDayType from DB values.
// For multi-day templates, uses the first day to pick the label.
export function dbToMassDayType(dbDayType: string, dbDayOfWeek: number | number[] | null): MassDayType {
  if (dbDayType === "SUNDAY") return "SUNDAY";
  if (dbDayType === "HOLY_DAY") return "HOLY_DAY";
  if (dbDayType === "SCHOOL_MASS") return "SCHOOL_MASS";
  const days = normalizeDaysOfWeek(dbDayOfWeek);
  const firstDay = days?.[0] ?? null;
  const map: Record<number, MassDayType> = {
    1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
    4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
  };
  return (firstDay !== null && map[firstDay]) ? map[firstDay] : "MONDAY";
}

// Human-readable label for a multi-day template's day pattern.
const DOW_SHORT: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
export function daysOfWeekLabel(dbDayType: string, dbDayOfWeek: number | number[] | null): string {
  if (dbDayType === "SUNDAY") return "Sunday";
  if (dbDayType === "HOLY_DAY") return "Holy Day";
  if (dbDayType === "SCHOOL_MASS") return "School Mass";
  const days = normalizeDaysOfWeek(dbDayOfWeek);
  if (!days || days.length === 0) return "Weekday";
  return days.map((d) => DOW_SHORT[d] ?? d).join("/");
}

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
  ADVENT:         "Advent",
  CHRISTMAS:      "Christmastide",
  ORDINARY_TIME:  "Ordinary Time",
  LENT:           "Lent",
  EASTER_TRIDUUM: "Easter Triduum",
  EASTER:         "Eastertide",
};

export const SEASON_COLORS: Record<LiturgicalSeason, string> = {
  ADVENT:         "bg-violet-700",
  CHRISTMAS:      "bg-yellow-500",
  ORDINARY_TIME:  "bg-green-700",
  LENT:           "bg-purple-700",
  EASTER_TRIDUUM: "bg-red-800",
  EASTER:         "bg-yellow-400",
};

// ---------------------------------------------------------------------------
// Assignment status
// ---------------------------------------------------------------------------
export type AssignmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "ABSENT";

// ---------------------------------------------------------------------------
// Staffing status
// ---------------------------------------------------------------------------
export type StaffingStatus = "RED" | "YELLOW" | "GREEN";

// ---------------------------------------------------------------------------
// Database row types
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
  date: string;
  season: LiturgicalSeason;
  is_high_feast: boolean;
  is_holy_day_of_obligation: boolean;
  feast_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface MassTime {
  id: string;
  liturgical_date_id: string;
  time_label: string;
  display_name: string;
  sort_order: number;
  is_special: boolean;
  template_id: string | null;
  language: MassLanguage;
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
  roles: MinisterRole[];
  is_active: boolean;
  notes: string | null;
  // Priest-specific fields (only meaningful when CELEBRANT role is present)
  priest_type: PriestType | null;
  minister_diocese: string | null;
  letter_of_suitability: boolean | null;
  letter_expiration_date: string | null;  // ISO date
  created_at: string;
}

export interface Assignment {
  id: string;
  mass_time_id: string;
  minister_id: string;
  role: MinisterRole;
  reading_label: string | null;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  minister?: Minister;
  mass_time?: MassTime;
}

export interface CheckIn {
  id: string;
  assignment_id: string;
  checked_in_at: string;
  checked_in_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mass Template types
// ---------------------------------------------------------------------------

export interface MassTemplateRoleConfig {
  id: string;
  template_id: string;
  role: MinisterRole;
  min_count: number;
  max_count: number;
}

export interface MassTemplate {
  id: string;
  parish_id: string;
  name: string;
  day_type: string;       // raw DB value: SUNDAY | WEEKDAY | HOLY_DAY | SCHOOL_MASS
  day_of_week: number | number[] | null;  // may be int (pre-migration) or int[] (post-migration)
  start_time: string;
  language: MassLanguage;
  notes: string | null;
  created_at: string;
  updated_at: string;
  role_configs?: MassTemplateRoleConfig[];
}

// ---------------------------------------------------------------------------
// Composite / View types
// ---------------------------------------------------------------------------

export interface MassTimeWithRoster extends MassTime {
  assignments: (Assignment & { minister: Minister })[];
  staffing_status: StaffingStatus;
  template?: MassTemplate | null;
}

export interface LiturgicalDateWithMasses extends LiturgicalDate {
  mass_times: MassTimeWithRoster[];
  overall_status: StaffingStatus;
}

export interface CalendarDayStatus {
  date: string;
  liturgical_date_id: string | null;
  is_sunday: boolean;
  is_feast_or_holy_day: boolean;
  feast_name: string | null;
  is_holy_day_of_obligation: boolean;
  season: LiturgicalSeason | null;
  status: StaffingStatus | null;
  languages: MassLanguage[];  // languages of masses on this day
}

export interface StaffingAlert {
  date: string;
  mass_time_id: string;
  time_label: string;
  display_name: string;
  status: StaffingStatus;
  missing_priest: boolean;
}

export interface CelebrantAlert {
  date: string;
  mass_time_id: string;
  time_label: string;
  display_name: string;
  minister_name: string;
  warning: "missing_letter" | "expired_letter";
}
