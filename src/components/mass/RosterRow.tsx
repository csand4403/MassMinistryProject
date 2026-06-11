import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import { CheckInButton } from "./CheckInButton";
import type { Assignment, Minister, CheckIn } from "@/types";

interface RosterRowProps {
  assignment: Assignment & { minister: Minister };
  checkIn: CheckIn | undefined;
}

const STATUS_CLASSES = {
  SCHEDULED:  "text-slate-500",
  PENDING:    "text-amber-600",
  CONFIRMED:  "text-navy-600 font-medium",
  DECLINED:   "text-red-500 line-through",
  CHECKED_IN: "text-green-600 font-semibold",
  ABSENT:     "text-red-500 line-through",
} as const;

const STATUS_LABELS = {
  SCHEDULED:  "Scheduled",
  PENDING:    "Pending",
  CONFIRMED:  "Confirmed",
  DECLINED:   "Declined",
  CHECKED_IN: "Checked In",
  ABSENT:     "Absent",
} as const;

function celebrantWarning(minister: Minister): string | null {
  if (minister.priest_type !== "VISITING_CELEBRANT") return null;
  if (!minister.letter_of_suitability) return "Letter of Suitability not on file";
  const isDallaDiocese = !minister.minister_diocese || minister.minister_diocese === "Diocese of Dallas";
  if (!isDallaDiocese && minister.letter_expiration_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (minister.letter_expiration_date < today) return "Letter of Suitability expired";
  }
  return null;
}

export function RosterRow({ assignment, checkIn }: RosterRowProps) {
  const { minister, status } = assignment;
  const isCheckedIn = status === "CHECKED_IN" || !!checkIn;
  const name = fullName(minister);
  const warning = celebrantWarning(minister);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isCheckedIn ? "bg-green-50" : "bg-white hover:bg-slate-50"
      )}
    >
      {/* Minister name + celebrant warning */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm", STATUS_CLASSES[status])}>{name}</span>
          {minister.priest_type === "VISITING_CELEBRANT" && (
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-sky-50 text-sky-700 ring-1 ring-sky-200 font-medium">
              Visiting
            </span>
          )}
          {warning && (
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-orange-50 text-orange-700 ring-1 ring-orange-300 font-medium flex items-center gap-1">
              ⚑ {warning}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", getStatusBadgeClass(status))}>
        {STATUS_LABELS[status]}
      </span>

      {/* Check-in toggle */}
      <CheckInButton
        assignmentId={assignment.id}
        isCheckedIn={isCheckedIn}
        ministerName={name}
      />
    </div>
  );
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "CHECKED_IN": return "bg-green-100 text-green-700";
    case "CONFIRMED":  return "bg-blue-100 text-blue-700";
    case "PENDING":    return "bg-amber-100 text-amber-700";
    case "DECLINED":   return "bg-red-100 text-red-700";
    case "ABSENT":     return "bg-red-100 text-red-700";
    default:           return "bg-slate-100 text-slate-500";
  }
}
