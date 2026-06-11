import { ROLE_DISPLAY_ORDER, type MassType, type MinisterRole } from "@/types";

export type RoleCounts = Record<MinisterRole, { min: number; max: number }>;

const ZERO_COUNTS = Object.fromEntries(
  ROLE_DISPLAY_ORDER.map((role) => [role, { min: 0, max: 0 }])
) as RoleCounts;

const ROLE_DEFAULTS: Record<MassType, Partial<RoleCounts>> = {
  DAILY_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 4 },
    USHER: { min: 1, max: 4 },
    ALTAR_SERVER: { min: 0, max: 4 },
  },
  SUNDAY_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 4 },
    USHER: { min: 1, max: 4 },
    ALTAR_SERVER: { min: 0, max: 4 },
  },
  SATURDAY_VIGIL: {
    CELEBRANT: { min: 1, max: 1 },
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 4 },
    USHER: { min: 1, max: 4 },
    ALTAR_SERVER: { min: 0, max: 4 },
  },
  FUNERAL: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 2, max: 4 },
    USHER: { min: 2, max: 4 },
  },
  WEDDING: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    ALTAR_SERVER: { min: 0, max: 2 },
  },
  HOLY_DAY_OF_OBLIGATION: {
    CELEBRANT: { min: 1, max: 1 },
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 2, max: 2 },
    PSALMIST: { min: 1, max: 1 },
    EMHC: { min: 4, max: 8 },
    USHER: { min: 4, max: 8 },
    ALTAR_SERVER: { min: 2, max: 6 },
  },
  SCHOOL_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    ALTAR_SERVER: { min: 2, max: 6 },
  },
  BAPTISM_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 2 },
  },
  QUINCEANERA_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 4 },
    USHER: { min: 1, max: 4 },
    ALTAR_SERVER: { min: 0, max: 4 },
  },
  MEMORIAL_MASS: {
    CELEBRANT: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 2 },
    USHER: { min: 1, max: 2 },
  },
  COMMUNION_SERVICE: {
    DEACON: { min: 1, max: 1 },
    LECTOR: { min: 1, max: 2 },
    EMHC: { min: 1, max: 4 },
    USHER: { min: 1, max: 2 },
  },
  LITURGY_OF_THE_WORD: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    USHER: { min: 1, max: 2 },
  },
  FUNERAL_VIGIL: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    USHER: { min: 1, max: 2 },
  },
  GRAVESIDE_SERVICE: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 1 },
  },
  WEDDING_CEREMONY_NON_MASS: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 2 },
    USHER: { min: 1, max: 2 },
  },
  QUINCEANERA_BLESSING: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 1 },
    USHER: { min: 1, max: 2 },
  },
  RECONCILIATION_SERVICE: {
    DEACON: { min: 0, max: 1 },
    LECTOR: { min: 1, max: 1 },
    USHER: { min: 1, max: 2 },
  },
  OTHER: {
    CELEBRANT: { min: 1, max: 1 },
  },
};

export function countsForType(type: MassType): RoleCounts {
  return {
    ...ZERO_COUNTS,
    ...ROLE_DEFAULTS[type],
  };
}

export function roleRowsForMassTime(massTimeId: string, type: MassType) {
  const counts = countsForType(type);
  return ROLE_DISPLAY_ORDER.map((role) => ({
    mass_time_id: massTimeId,
    role,
    min_count: counts[role].min,
    max_count: counts[role].max,
  })).filter((config) => config.min_count > 0 || config.max_count > 0);
}
