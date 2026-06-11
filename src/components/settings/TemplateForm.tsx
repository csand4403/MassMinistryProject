"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate } from "@/lib/actions";
import {
  ROLE_LABELS,
  LANGUAGE_LABELS,
  ROLE_DISPLAY_ORDER,
  normalizeDaysOfWeek,
} from "@/types";
import { normalizeRole } from "@/lib/staffing";
import type { MassTemplate, MinisterRole, MassDayType, MassLanguage } from "@/types";

const ALL_ROLES = ROLE_DISPLAY_ORDER;

const LANGUAGE_OPTIONS: MassLanguage[] = [
  "ENGLISH",
  "SPANISH",
  "FRENCH",
  "BILINGUAL_EN_ES",
  "BILINGUAL_EN_FR",
];

// Weekday options for multi-select (Mon–Sat)
const WEEKDAY_OPTIONS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
];

type DayCategory = "SUNDAY" | "WEEKDAY" | "HOLY_DAY" | "SCHOOL_MASS";

const DAY_CATEGORY_LABELS: Record<DayCategory, string> = {
  SUNDAY:      "Sunday",
  WEEKDAY:     "Weekday",
  HOLY_DAY:    "Holy Day",
  SCHOOL_MASS: "School Mass",
};

interface RoleConfig {
  role: MinisterRole;
  min_count: number;
  max_count: number;
}

function defaultRoleConfigs(existing?: MassTemplate): RoleConfig[] {
  return ALL_ROLES.map((role) => {
    // Normalize DB role names (e.g. LECTOR_1 → LECTOR) when matching
    const found = existing?.role_configs?.find((rc) => normalizeRole(rc.role) === role);
    return {
      role,
      min_count: found?.min_count ?? 0,
      max_count: found?.max_count ?? (role === "CELEBRANT" ? 1 : role === "LECTOR" ? 2 : 4),
    };
  });
}

function templateToForm(template: MassTemplate): { category: DayCategory; daysOfWeek: number[] } {
  if (template.day_type === "SUNDAY") return { category: "SUNDAY", daysOfWeek: [] };
  if (template.day_type === "HOLY_DAY") return { category: "HOLY_DAY", daysOfWeek: [] };
  if (template.day_type === "SCHOOL_MASS") return { category: "SCHOOL_MASS", daysOfWeek: [] };
  // WEEKDAY — parse days
  const days = normalizeDaysOfWeek(template.day_of_week) ?? [];
  return { category: "WEEKDAY", daysOfWeek: days };
}

interface TemplateFormProps {
  template?: MassTemplate;
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial = template ? templateToForm(template) : { category: "SUNDAY" as DayCategory, daysOfWeek: [] };

  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState<DayCategory>(initial.category);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial.daysOfWeek);
  const [startTime, setStartTime] = useState(template?.start_time ?? "08:00");
  const [language, setLanguage] = useState<MassLanguage>(template?.language ?? "ENGLISH");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>(defaultRoleConfigs(template));

  const toggleDow = (dow: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    );
  };

  const updateRole = (role: MinisterRole, field: "min_count" | "max_count", value: number) => {
    setRoleConfigs((prev) =>
      prev.map((rc) => (rc.role === role ? { ...rc, [field]: Math.max(0, value) } : rc))
    );
  };

  // Map category back to a MassDayType for the action (use first selected day or Monday)
  const primaryDayType: MassDayType = (() => {
    if (category === "SUNDAY") return "SUNDAY";
    if (category === "HOLY_DAY") return "HOLY_DAY";
    if (category === "SCHOOL_MASS") return "SCHOOL_MASS";
    const DOW_TO_TYPE: Record<number, MassDayType> = { 1:"MONDAY",2:"TUESDAY",3:"WEDNESDAY",4:"THURSDAY",5:"FRIDAY",6:"SATURDAY" };
    return DOW_TO_TYPE[daysOfWeek[0] ?? 1] ?? "MONDAY";
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (category === "WEEKDAY" && daysOfWeek.length === 0) {
      setError("Select at least one day of the week.");
      return;
    }

    for (const rc of roleConfigs) {
      if (rc.max_count < rc.min_count) {
        setError(`Max must be ≥ Min for ${ROLE_LABELS[rc.role]}.`);
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        day_type: primaryDayType,
        days_of_week: category === "WEEKDAY" ? daysOfWeek : undefined,
        start_time: startTime,
        language,
        notes: notes.trim() || undefined,
        role_configs: roleConfigs,
      };

      const result = template
        ? await updateTemplate(template.id, payload)
        : await createTemplate(payload);

      if (!result.success) {
        setError(result.error ?? "Failed to save template");
        return;
      }
      router.push("/settings");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Basic info */}
      <section className="parish-card p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800">Template Details</h2>

        <Field label="Template Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Sunday 8:00 AM" or "Weekday 8:15 AM (Mon/Wed/Fri)"'
            className={inputClass}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Day Type" required>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as DayCategory);
                setDaysOfWeek([]);
              }}
              className={inputClass}
            >
              {(Object.keys(DAY_CATEGORY_LABELS) as DayCategory[]).map((cat) => (
                <option key={cat} value={cat}>{DAY_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </Field>

          <Field label="Start Time" required>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {/* Weekday multi-select */}
        {category === "WEEKDAY" && (
          <Field label="Days of Week" required>
            <div className="flex flex-wrap gap-2 mt-1">
              {WEEKDAY_OPTIONS.map(({ dow, label }) => (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleDow(dow)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                    daysOfWeek.includes(dow)
                      ? "bg-navy-700 text-white border-navy-700"
                      : "bg-white text-slate-600 border-slate-200 hover:border-navy-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {daysOfWeek.length > 0 && (
              <p className="text-xs text-slate-400 mt-1.5">
                Selected: {daysOfWeek.map((d) => WEEKDAY_OPTIONS.find((o) => o.dow === d)?.label).join(", ")}
              </p>
            )}
          </Field>
        )}

        <Field label="Language" required>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as MassLanguage)}
            className={inputClass}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes about this template…"
            className={cn(inputClass, "resize-none")}
          />
        </Field>
      </section>

      {/* Role requirements */}
      <section className="parish-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Role Requirements</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set the minimum required and maximum allowed count for each role at this Mass.
            Roles with Min = 0 are optional.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-2 pr-4 font-medium text-slate-600">Role</th>
                <th className="pb-2 px-3 font-medium text-slate-600 text-center w-24">Min Required</th>
                <th className="pb-2 px-3 font-medium text-slate-600 text-center w-24">Max Allowed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roleConfigs.map((rc) => (
                <tr key={rc.role} className="hover:bg-slate-50/50">
                  <td className="py-2.5 pr-4 text-slate-700 font-medium">{ROLE_LABELS[rc.role]}</td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={rc.min_count}
                      onChange={(e) => updateRole(rc.role, "min_count", parseInt(e.target.value) || 0)}
                      className={cn(inputClass, "text-center")}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={rc.max_count}
                      onChange={(e) => updateRole(rc.role, "max_count", parseInt(e.target.value) || 0)}
                      className={cn(inputClass, "text-center")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 pb-4">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "rounded-lg bg-navy-800 px-5 py-2 text-sm font-semibold text-white",
            "hover:bg-navy-700 transition-colors",
            isPending && "opacity-60 cursor-not-allowed"
          )}
        >
          {isPending ? "Saving…" : template ? "Save Changes" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="rounded-lg px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
