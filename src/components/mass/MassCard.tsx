import Link from "next/link";
import { MassMetadataEditor } from "@/components/mass/MassMetadataEditor";
import { MassStatusButton } from "@/components/mass/MassStatusButton";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import {
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  STATUS_LABELS,
} from "@/lib/staffing";
import { LANGUAGE_SHORT, MASS_STATUS_LABELS, MASS_TAG_LABELS, MASS_TYPE_LABELS, ROLE_SHORT_LABELS } from "@/types";
import type { MassTimeWithRoster } from "@/types";

interface MassCardProps {
  massTime: MassTimeWithRoster;
  date: string; // "YYYY-MM-DD"
}

/**
 * Card shown in the Mass Day View for a single Mass time.
 * Shows time, status, and a quick summary of assigned ministers.
 */
export function MassCard({ massTime, date }: MassCardProps) {
  const { staffing_status, assignments } = massTime;
  const isCancelled = massTime.status === "CANCELLED";
  const isBaselineMass = ["DAILY_MASS", "SUNDAY_MASS", "SATURDAY_VIGIL"].includes(massTime.mass_type);
  const celebrant = assignments.find((a) => a.role === "CELEBRANT");
  const deacon = assignments.find((a) => a.role === "DEACON");
  const lectors = assignments.filter((a) => a.role === "LECTOR");
  const emhcs = assignments.filter((a) => a.role === "EMHC");
  const ushers = assignments.filter((a) => a.role === "USHER");

  return (
    <div
      className={cn(
        "parish-card block transition-shadow focus-within:ring-2 focus-within:ring-navy-400",
        isCancelled ? "bg-slate-50 opacity-75" : "hover:shadow-md"
      )}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className={cn("text-lg font-bold", isCancelled ? "text-slate-500 line-through" : "text-navy-900")}>
              {massTime.time_label}
            </p>
            <p className="text-sm text-slate-500">
              {massTime.display_name}
              {massTime.mass_type && (
                <span className={cn(
                  "ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  isBaselineMass
                    ? "bg-slate-50 text-slate-500"
                    : "bg-parish-50 text-parish-700"
                )}>
                  {MASS_TYPE_LABELS[massTime.mass_type]}
                </span>
              )}
              {massTime.language && (
                <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                  {LANGUAGE_SHORT[massTime.language]}
                </span>
              )}
            </p>
            {massTime.notes && (
              <p className="mt-1 text-xs text-slate-400">{massTime.notes}</p>
            )}
            {massTime.mass_tags && massTime.mass_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {massTime.mass_tags.map((tag) => (
                  <span key={tag} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {MASS_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Staffing status badge */}
          {isCancelled ? (
            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {MASS_STATUS_LABELS.CANCELLED}
            </span>
          ) : (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                STATUS_BADGE_CLASSES[staffing_status]
              )}
              title={STATUS_LABELS[staffing_status]}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STATUS_DOT_CLASSES[staffing_status]
                )}
              />
              {STATUS_LABELS[staffing_status]}
            </span>
          )}
        </div>

        {/* Mini roster summary */}
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
          <RosterLine
            label="Priest"
            value={celebrant ? fullName(celebrant.minister!) : undefined}
            required
          />
          <RosterLine
            label="Deacon"
            value={deacon ? fullName(deacon.minister!) : undefined}
          />
          <RosterLine
            label="Lectors"
            value={lectors.length > 0 ? `${lectors.length} assigned` : undefined}
          />
          <RosterLine
            label="EMHCs"
            value={emhcs.length > 0 ? `${emhcs.length} assigned` : undefined}
          />
          <RosterLine
            label="Ushers"
            value={ushers.length > 0 ? `${ushers.length} assigned` : undefined}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/mass/${date}/${massTime.id}`}
            className="text-xs font-semibold text-navy-600 hover:text-navy-800 transition-colors"
          >
            View full roster →
          </Link>
          <MassStatusButton massTimeId={massTime.id} date={date} status={massTime.status} size="xs" />
        </div>
        <MassMetadataEditor massTime={massTime} date={date} />
      </div>
    </div>
  );
}

function RosterLine({
  label,
  value,
  required = false,
}: {
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400 w-20 flex-shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm font-medium truncate",
          value ? "text-slate-700" : required ? "text-red-500" : "text-slate-400 italic"
        )}
      >
        {value ?? (required ? "UNASSIGNED" : "—")}
      </span>
    </div>
  );
}
