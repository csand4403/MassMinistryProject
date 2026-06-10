import Link from "next/link";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import {
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  STATUS_LABELS,
} from "@/lib/staffing";
import { ROLE_SHORT_LABELS } from "@/types";
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
  const celebrant = assignments.find((a) => a.role === "CELEBRANT");
  const deacon = assignments.find((a) => a.role === "DEACON");
  const lectors = assignments.filter((a) => a.role === "LECTOR");
  const emhcs = assignments.filter((a) => a.role === "EMHC");
  const ushers = assignments.filter((a) => a.role === "USHER");

  return (
    <Link
      href={`/mass/${date}/${massTime.id}`}
      className="parish-card block hover:shadow-md transition-shadow focus-ring group"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-lg font-bold text-navy-900 group-hover:text-navy-700">
              {massTime.time_label}
            </p>
            <p className="text-sm text-slate-500">{massTime.display_name}</p>
          </div>

          {/* Staffing status badge */}
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

        <p className="mt-3 text-xs text-slate-400 group-hover:text-navy-500 transition-colors">
          View full roster →
        </p>
      </div>
    </Link>
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
