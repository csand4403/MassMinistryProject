"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate } from "@/lib/actions";
import {
  ROLE_LABELS,
  LANGUAGE_LABELS,
  DAY_TYPE_LABELS,
  ROLE_DISPLAY_ORDER,
  dbToMassDayType,
} from "@/types";
import type { MassTemplate, MinisterRole, MassDayType, MassLanguage } from "@/types";

const ALL_ROLES = ROLE_DISPLAY_ORDER;

const LANGUAGE_OPTIONS: MassLanguage[] = [
  "ENGLISH",
  "SPANISH",
  "FRENCH",
  "BILINGUAL_EN_ES",
  "BILINGUAL_EN_FR",
];

const DAY_TYPE_OPTIONS: MassDayType[] = [
  "SUNDAY",
  "SATURDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "HOLY_DAY",
  "SCHOOL_MASS",
];

interface RoleConfig {
  role: MinisterRole;
  min_count: number;
  max_count: number;
}

function defaultRoleConfigs(existing?: MassTemplate): RoleConfig[] {
  return ALL_ROLES.map((role) => {
    const found = existing?.role_configs?.find((rc) => rc.role === role);
    return {
      role,
      min_count: found?.min_count ?? 0,
      max_count: found?.max_count ?? (role === "CELEBRANT" ? 1 : role === "LECTOR" ? 2 : 4),
    };
  });
}

interface TemplateFormProps {
  template?: MassTemplate;
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [dayType, setDayType] = useState<MassDayType>(
    template ? dbToMassDayType(template.day_type, template.day_of_week) : "SUNDAY"
  );
  const [startTime, setStartTime] = useState(template?.start_time ?? "08:00");
  const [language, setLanguage] = useState<MassLanguage>(template?.language ?? "ENGLISH");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>(defaultRoleConfigs(template));

  const updateRole = (role: MinisterRole, field: "min_count" | "max_count", value: number) => {
    setRoleConfigs((prev) =>
      prev.map((rc) => (rc.role === role ? { ...rc, [field]: Math.max(0, value) } : rc))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    // Validate max >= min for each role
    for (const rc of roleConfigs) {
      if (rc.max_count < rc.min_count) {
        setError(`Max must be ≥ Min for ${ROLE_LABELS[rc.role]}.`);
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        day_type: dayType,
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
            placeholder='e.g. "Sunday 8:00 AM"'
            className={inputClass}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Day Type" required>
            <select
              value={dayType}
              onChange={(e) => setDayType(e.target.value as MassDayType)}
              className={inputClass}
            >
              {DAY_TYPE_OPTIONS.map((dt) => (
                <option key={dt} value={dt}>{DAY_TYPE_LABELS[dt]}</option>
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

      {/* Role minimums / maximums */}
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
