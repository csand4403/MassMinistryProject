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
// ---------------------------------------------------------------------------
export type MassDayType = "SUNDAY" | "WEEKDAY" | "HOLY_DAY" | "SCHOOL_MASS";

export const DAY_TYPE_LABELS: Record<MassDayType, string> = {
  SUNDAY:      "Sunday",
  WEEKDAY:     "Weekday",
  HOLY_DAY:    "Holy Day",
  SCHOOL_MASS: "School Mass",
};

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
  day_type: MassDayType;
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
