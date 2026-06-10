"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { deleteTemplate } from "@/lib/actions";
import {
  LANGUAGE_LABELS,
  LANGUAGE_SHORT,
  DAY_TYPE_LABELS,
  ROLE_SHORT_LABELS,
  dbToMassDayType,
} from "@/types";
import type { MassTemplate } from "@/types";

interface TemplateListProps {
  templates: MassTemplate[];
}

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

  return (
    <div className="space-y-3">
      {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
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

  // Format display time (HH:MM → 12-hr)
  const displayTime = formatTime(t.start_time);

  return (
    <div className="parish-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-800">{t.name}</h3>
            <span className="text-xs rounded-full px-2 py-0.5 bg-navy-100 text-navy-700 font-medium">
              {DAY_TYPE_LABELS[dbToMassDayType(t.day_type, t.day_of_week)]}
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
  // time may be "HH:MM" or "HH:MM:SS"
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
