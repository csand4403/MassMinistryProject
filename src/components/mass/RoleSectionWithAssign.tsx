"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, MULTI_SLOT_ROLES } from "@/types";
import { RosterRow } from "./RosterRow";
import { AssignMinisterModal } from "./AssignMinisterModal";
import type { Assignment, Minister, CheckIn, MinisterRole } from "@/types";

interface RoleSectionWithAssignProps {
  role: MinisterRole;
  massTimeId: string;
  assignments: (Assignment & { minister: Minister })[];
  checkIns: Map<string, CheckIn>;
  eligibleMinisters: Minister[];
}

/**
 * RoleSection with an interactive Assign/Quick Assign button that opens a modal.
 * Used in the Mass Detail View where coordinators can make assignments.
 */
export function RoleSectionWithAssign({
  role,
  massTimeId,
  assignments,
  checkIns,
  eligibleMinisters,
}: RoleSectionWithAssignProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const isCelebrant = role === "CELEBRANT";
  const isDeacon = role === "DEACON";

  // Multi-slot roles allow multiple assignments; LECTOR capped at 2
  const isMultiSlot = MULTI_SLOT_ROLES.includes(role);
  const isLectorFull = role === "LECTOR" && assignments.length >= 2;

  // For single-slot roles, pass the existing (first) assignment for replace logic
  const singleExisting = !isMultiSlot ? assignments[0] : undefined;

  // Empty slot = unfilled; use quick-assign mode for a one-tap UX
  const isEmpty = assignments.length === 0;
  const useQuickMode = isEmpty;

  // Determine button label
  const buttonLabel = isMultiSlot
    ? "＋ Add"
    : isEmpty
    ? "Quick Assign"
    : "Change";

  return (
    <div>
      {/* Role header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {ROLE_LABELS[role]}
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

        {/* Assign / Add / Change button */}
        {!isLectorFull && (
          <button
            onClick={() => setModalOpen(true)}
            style={!(isCelebrant && isEmpty) && isEmpty ? { backgroundColor: "#286b73" } : undefined}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              isCelebrant && isEmpty
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : isEmpty
                ? "text-white hover:opacity-90"
                : "bg-teal-50 text-teal-700 hover:bg-teal-100"
            )}
          >
            {buttonLabel}
          </button>
        )}
      </div>

      {/* Assignments or empty state */}
      {isEmpty ? (
        <div
          className={cn(
            "rounded-lg px-3 py-3 text-sm cursor-pointer transition-colors",
            isCelebrant
              ? "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100"
              : isDeacon
              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
              : "bg-slate-50 text-slate-400 hover:bg-slate-100"
          )}
          onClick={() => setModalOpen(true)}
        >
          <span className="italic">
            {isCelebrant
              ? "⚠ No Priest assigned — tap to assign"
              : "Unassigned — tap to assign"}
          </span>
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

      {/* Assignment modal */}
      <AssignMinisterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        massTimeId={massTimeId}
        role={role}
        existingAssignment={singleExisting}
        eligibleMinisters={eligibleMinisters}
        quickMode={useQuickMode}
      />
    </div>
  );
}
