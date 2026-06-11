"use client";

import { updateMassMetadata } from "@/lib/actions";
import {
  MASS_TAG_LABELS,
  MASS_TAG_OPTIONS,
  MASS_TYPE_LABELS,
  MASS_TYPE_OPTIONS,
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

  return (
    <details className="mt-3 rounded border border-slate-200 bg-slate-50/60 p-3">
      <summary className="cursor-pointer list-none text-xs font-semibold text-navy-700">
        Edit labels
      </summary>

      <form action={updateMassMetadata} className="mt-3 space-y-3">
        <input type="hidden" name="mass_time_id" value={massTime.id} />
        <input type="hidden" name="date" value={date} />

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Primary Type
          </span>
          <select
            name="mass_type"
            defaultValue={massTime.mass_type as MassType}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {MASS_TYPE_OPTIONS.map((type) => (
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
