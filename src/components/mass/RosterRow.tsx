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
  CONFIRMED:  "text-navy-600 font-medium",
  CHECKED_IN: "text-green-600 font-semibold",
  ABSENT:     "text-red-500 line-through",
} as const;

const STATUS_LABELS = {
  SCHEDULED:  "Scheduled",
  CONFIRMED:  "Confirmed",
  CHECKED_IN: "Checked In",
  ABSENT:     "Absent",
} as const;

/**
 * A single row in the Mass Detail roster.
 * Shows the minister's name, current status, reading label (for lectors),
 * and the check-in toggle button.
 */
export function RosterRow({ assignment, checkIn }: RosterRowProps) {
  const { minister, status } = assignment;
  const isCheckedIn = status === "CHECKED_IN" || !!checkIn;
  const name = fullName(minister);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isCheckedIn ? "bg-green-50" : "bg-white hover:bg-slate-50"
      )}
    >
      {/* Minister name */}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm", STATUS_CLASSES[status])}>
          {name}
        </span>
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
    case "ABSENT":     return "bg-red-100 text-red-700";
    default:           return "bg-slate-100 text-slate-500";
  }
}
