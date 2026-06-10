import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";
import { RosterRow } from "./RosterRow";
import type { Assignment, Minister, CheckIn, MinisterRole } from "@/types";

interface RoleSectionProps {
  role: MinisterRole;
  assignments: (Assignment & { minister: Minister })[];
  checkIns: Map<string, CheckIn>;
}

/**
 * A grouped section in the Mass Detail roster for one role.
 * Shows the role name as a header, then each assigned minister row,
 * or an "Unassigned" placeholder if no one is assigned.
 */
export function RoleSection({ role, assignments, checkIns }: RoleSectionProps) {
  const label = ROLE_LABELS[role];
  const isCelebrant = role === "CELEBRANT";
  const isDeacon = role === "DEACON";

  return (
    <div>
      {/* Role header */}
      <div className="flex items-center gap-2 mb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </h3>
        {isCelebrant && (
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
            Required
          </span>
        )}
        {isDeacon && (
          <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">
            Expected
          </span>
        )}
      </div>

      {/* Assignments or empty state */}
      {assignments.length === 0 ? (
        <div
          className={cn(
            "rounded-lg px-3 py-2.5 text-sm italic",
            isCelebrant
              ? "bg-red-50 text-red-600 ring-1 ring-red-200"
              : isDeacon
              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              : "bg-slate-50 text-slate-400"
          )}
        >
          {isCelebrant ? "⚠ No celebrant assigned" : "Unassigned"}
        </div>
      ) : (
        <div className="space-y-1 rounded-lg overflow-hidden ring-1 ring-slate-100">
          {assignments.map((a) => (
            <RosterRow
              key={a.id}
              assignment={a}
              checkIn={checkIns.get(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
