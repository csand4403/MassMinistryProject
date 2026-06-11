"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { deleteTemplate } from "@/lib/actions";
import {
  LANGUAGE_LABELS,
  LANGUAGE_SHORT,
  ROLE_SHORT_LABELS,
  daysOfWeekLabel,
  normalizeDaysOfWeek,
} from "@/types";
import type { MassTemplate } from "@/types";

interface TemplateListProps {
  templates: MassTemplate[];
}

// ─── Grouping ────────────────────────────────────────────────────────────────

type GroupKey = "SUNDAY" | "SATURDAY" | "WEEKDAY" | "HOLY_DAY" | "SCHOOL_MASS";

const GROUP_LABELS: Record<GroupKey, string> = {
  SUNDAY:      "Sunday",
  SATURDAY:    "Saturday",
  WEEKDAY:     "Weekdays",
  HOLY_DAY:    "Holy Days",
  SCHOOL_MASS: "School Masses",
};

const GROUP_ORDER: GroupKey[] = ["SUNDAY", "SATURDAY", "WEEKDAY", "HOLY_DAY", "SCHOOL_MASS"];

function templateGroup(t: MassTemplate): GroupKey {
  if (t.day_type === "SUNDAY") return "SUNDAY";
  if (t.day_type === "HOLY_DAY") return "HOLY_DAY";
  if (t.day_type === "SCHOOL_MASS") return "SCHOOL_MASS";
  // WEEKDAY — check if Saturday only
  const days = normalizeDaysOfWeek(t.day_of_week) ?? [];
  if (days.length === 1 && days[0] === 6) return "SATURDAY";
  return "WEEKDAY";
}

function sortTemplates(a: MassTemplate, b: MassTemplate): number {
  return a.start_time.localeCompare(b.start_time);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TemplateList({ templates }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <div className="parish-card p-8 text-center">
        <div className="text-slate-400 text-sm">No templates yet.</div>
        <p className="text-xs text-slate-400 mt-1">
          Create your first Mass blueprint to define role requirements.
        </p>
      </div>
    );
  }

  // Group templates
  const groups = new Map<GroupKey, MassTemplate[]>();
  for (const t of templates) {
    const key = templateGroup(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  Array.from(groups.values()).forEach((list) => list.sort(sortTemplates));

  return (
    <div className="space-y-3">
      {GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
        <TemplateGroup key={g} label={GROUP_LABELS[g]} templates={groups.get(g) ?? []} />
      ))}
    </div>
  );
}

function TemplateGroup({ label, templates }: { label: string; templates: MassTemplate[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="parish-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100 text-left hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">
          {label}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </span>
        </span>
        <span className="text-xs text-slate-400 flex-shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template: t }: { template: MassTemplate }) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTemplate(t.id);
      setConfirmDelete(false);
    });
  };

  const requiredRoles = (t.role_configs ?? []).filter((rc) => rc.min_count > 0);
  const optionalRoles = (t.role_configs ?? []).filter((rc) => rc.min_count === 0 && rc.max_count > 0);
  const displayTime = formatTime(t.start_time);
  const dayLabel = daysOfWeekLabel(t.day_type, t.day_of_week);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-800">{t.name}</h3>
            <span className="text-xs rounded-full px-2 py-0.5 bg-navy-100 text-navy-700 font-medium">
              {dayLabel}
            </span>
            <span className="text-xs rounded-full px-2 py-0.5 bg-parish-100 text-parish-700 font-medium">
              {LANGUAGE_SHORT[t.language]}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{displayTime} · {LANGUAGE_LABELS[t.language]}</p>

          {requiredRoles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {requiredRoles.map((rc) => (
                <span
                  key={rc.role}
                  className="text-[11px] rounded px-1.5 py-0.5 bg-green-50 text-green-700 ring-1 ring-green-200 font-medium"
                >
                  {ROLE_SHORT_LABELS[rc.role as keyof typeof ROLE_SHORT_LABELS] ?? rc.role} ≥{rc.min_count}
                </span>
              ))}
              {optionalRoles.map((rc) => (
                <span
                  key={rc.role}
                  className="text-[11px] rounded px-1.5 py-0.5 bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                >
                  {ROLE_SHORT_LABELS[rc.role as keyof typeof ROLE_SHORT_LABELS] ?? rc.role} opt
                </span>
              ))}
            </div>
          )}

          {t.notes && (
            <p className="mt-2 text-xs text-slate-400 italic">{t.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/settings/templates/${t.id}/edit`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-700 border border-navy-200 hover:bg-navy-50 transition-colors"
          >
            Edit
          </Link>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
