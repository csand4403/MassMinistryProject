"use client";

import { useState } from "react";
import { updateMassMetadata } from "@/lib/actions";
import {
  CELEBRATION_CATEGORY_LABELS,
  MASS_TAG_LABELS,
  MASS_TAG_OPTIONS,
  MASS_TYPES_BY_CATEGORY,
  MASS_TYPE_LABELS,
  categoryForMassType,
  type CelebrationCategory,
  type MassTag,
  type MassTimeWithRoster,
  type MassType,
} from "@/types";

export function MassMetadataEditor({
  massTime,
  date,
}: {
  massTime: MassTimeWithRoster;
  date: string;
}) {
  const selectedTags = new Set((massTime.mass_tags ?? []) as MassTag[]);
  const initialCategory = massTime.celebration_category ?? categoryForMassType(massTime.mass_type);
  const [category, setCategory] = useState<CelebrationCategory>(initialCategory);
  const [massType, setMassType] = useState<MassType>(massTime.mass_type);

  const updateCategory = (nextCategory: CelebrationCategory) => {
    setCategory(nextCategory);
    setMassType(MASS_TYPES_BY_CATEGORY[nextCategory][0]);
  };

  return (
    <details className="mt-3 rounded border border-slate-200 bg-slate-50/60 p-3">
      <summary className="cursor-pointer list-none text-xs font-semibold text-navy-700">
        Edit labels
      </summary>

      <form action={updateMassMetadata} className="mt-3 space-y-3">
        <input type="hidden" name="mass_time_id" value={massTime.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="celebration_category" value={category} />

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
          </span>
          <select
            value={category}
            onChange={(event) => updateCategory(event.target.value as CelebrationCategory)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {(Object.keys(CELEBRATION_CATEGORY_LABELS) as CelebrationCategory[]).map((item) => (
              <option key={item} value={item}>
                {CELEBRATION_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type
          </span>
          <select
            name="mass_type"
            value={massType}
            onChange={(event) => setMassType(event.target.value as MassType)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {MASS_TYPES_BY_CATEGORY[category].map((type) => (
              <option key={type} value={type}>
                {MASS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Additional Tags
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MASS_TAG_OPTIONS.map((tag) => (
              <label key={tag} className="flex items-center gap-2 rounded bg-white px-2 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  name="mass_tags"
                  value={tag}
                  defaultChecked={selectedTags.has(tag)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                {MASS_TAG_LABELS[tag]}
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notes
          </span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={massTime.notes ?? ""}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
        >
          Save labels
        </button>
      </form>
    </details>
  );
}
