"use client";

import { useMemo, useState } from "react";
import { createOneOffMass } from "@/lib/actions";
import { inferMassTypeForDateTime } from "@/lib/liturgical-calendar";
import { countsForType, type RoleCounts } from "@/lib/role-defaults";
import {
  CELEBRATION_CATEGORY_LABELS,
  LANGUAGE_LABELS,
  MASS_TYPES_BY_CATEGORY,
  MASS_TYPE_LABELS,
  ROLE_DISPLAY_ORDER,
  ROLE_SHORT_LABELS,
  categoryForMassType,
  type CelebrationCategory,
  type MassLanguage,
  type MassType,
  type MinisterRole,
} from "@/types";

const LANGUAGES: MassLanguage[] = [
  "ENGLISH",
  "SPANISH",
  "FRENCH",
  "BILINGUAL_EN_ES",
  "BILINGUAL_EN_FR",
];

export function AddMassForm({
  date,
  defaultMassType = inferMassTypeForDateTime(date),
}: {
  date: string;
  defaultMassType?: MassType;
}) {
  const [category, setCategory] = useState<CelebrationCategory>(categoryForMassType(defaultMassType));
  const [massType, setMassType] = useState<MassType>(defaultMassType);
  const [typeTouched, setTypeTouched] = useState(false);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(() => countsForType(defaultMassType));

  const visibleRoles = useMemo(
    () => ROLE_DISPLAY_ORDER.filter((role) => roleCounts[role].min > 0 || roleCounts[role].max > 0),
    [roleCounts]
  );

  const updateMassType = (nextType: MassType) => {
    setTypeTouched(true);
    setMassType(nextType);
    setRoleCounts(countsForType(nextType));
  };

  const updateCategory = (nextCategory: CelebrationCategory) => {
    const nextType = MASS_TYPES_BY_CATEGORY[nextCategory][0];
    setCategory(nextCategory);
    setTypeTouched(true);
    setMassType(nextType);
    setRoleCounts(countsForType(nextType));
  };

  const updateStartTime = (startTime: string) => {
    if (typeTouched) return;
    const inferred = inferMassTypeForDateTime(date, startTime);
    setCategory(categoryForMassType(inferred));
    setMassType(inferred);
    setRoleCounts(countsForType(inferred));
  };

  const updateRole = (role: MinisterRole, field: "min" | "max", value: number) => {
    setRoleCounts((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: Math.max(0, value),
      },
    }));
  };

  return (
    <details className="parish-card p-4">
      <summary className="cursor-pointer list-none">
        <span className="inline-flex items-center rounded bg-navy-700 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800">
          Add Mass
        </span>
      </summary>

      <form action={createOneOffMass} className="mt-4 space-y-4">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="celebration_category" value={category} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</span>
            <input
              name="start_time"
              type="time"
              required
              onChange={(event) => updateStartTime(event.target.value)}
              className="mt-1 w-full min-w-32 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</span>
            <select
              name="language"
              defaultValue="ENGLISH"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_LABELS[language]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
            <select
              value={category}
              onChange={(event) => updateCategory(event.target.value as CelebrationCategory)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(CELEBRATION_CATEGORY_LABELS) as CelebrationCategory[]).map((item) => (
                <option key={item} value={item}>
                  {CELEBRATION_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
            <select
              name="mass_type"
              value={massType}
              onChange={(event) => updateMassType(event.target.value as MassType)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {MASS_TYPES_BY_CATEGORY[category].map((type) => (
                <option key={type} value={type}>
                  {MASS_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Role Requirements
          </p>
          <div className="overflow-hidden rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="w-24 px-3 py-2 text-left">Min</th>
                  <th className="w-24 px-3 py-2 text-left">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(visibleRoles.length > 0 ? visibleRoles : ROLE_DISPLAY_ORDER.slice(0, 1)).map((role) => (
                  <tr key={role}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {ROLE_SHORT_LABELS[role]}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        name={`role_${role}_min`}
                        value={roleCounts[role].min}
                        onChange={(event) => updateRole(role, "min", Number(event.target.value))}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        name={`role_${role}_max`}
                        value={roleCounts[role].max}
                        onChange={(event) => updateRole(role, "max", Number(event.target.value))}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
        >
          Save Mass
        </button>
      </form>
    </details>
  );
}
