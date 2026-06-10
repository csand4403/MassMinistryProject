"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import { createAssignment, createMultipleAssignments, deleteAssignment } from "@/lib/actions";
import { ROLE_LABELS, MULTI_SLOT_ROLES } from "@/types";
import type { Minister, MinisterRole, Assignment } from "@/types";

interface AssignMinisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  massTimeId: string;
  role: MinisterRole;
  existingAssignment?: Assignment & { minister: Minister };
  eligibleMinisters: Minister[];
  quickMode?: boolean;
}

export function AssignMinisterModal({
  isOpen,
  onClose,
  massTimeId,
  role,
  existingAssignment,
  eligibleMinisters,
  quickMode = false,
}: AssignMinisterModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMinisterId, setSelectedMinisterId] = useState<string>("");
  const [selectedMinisterIds, setSelectedMinisterIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMultiSlot = MULTI_SLOT_ROLES.includes(role);
  const isQuickMode = quickMode && !existingAssignment;

  const toggleMinister = (id: string) => {
    setSelectedMinisterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignSingle = (ministerId?: string) => {
    const id = ministerId ?? selectedMinisterId;
    if (!id) {
      setError("Please select a minister.");
      return;
    }
    setError(null);

    startTransition(async () => {
      if (existingAssignment) {
        await deleteAssignment(existingAssignment.id);
      }
      const result = await createAssignment(massTimeId, id, role);
      if (!result.success) {
        setError(result.error ?? "Failed to assign minister");
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const handleAssignMultiple = () => {
    if (selectedMinisterIds.size === 0) {
      setError("Please select at least one minister.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createMultipleAssignments(
        massTimeId,
        Array.from(selectedMinisterIds),
        role,
      );
      if (!result.success) {
        setError(result.error ?? "Failed to assign ministers");
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const handleRemove = () => {
    if (!existingAssignment) return;
    startTransition(async () => {
      await deleteAssignment(existingAssignment.id);
      router.refresh();
      onClose();
    });
  };

  const subtitle = isMultiSlot
    ? "Select one or more ministers to assign"
    : isQuickMode
    ? "Tap a name to assign immediately"
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {isMultiSlot || isQuickMode ? "Quick Assign" : "Assign"} — {ROLE_LABELS[role]}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {existingAssignment && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              Currently assigned: <strong>{fullName(existingAssignment.minister)}</strong>
              <br />
              <span className="text-xs">Selecting a new minister will replace this assignment.</span>
            </div>
          )}

          <div>
            {!isQuickMode && !isMultiSlot && (
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select Minister
              </label>
            )}
            {eligibleMinisters.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No active ministers are qualified for this role.
              </p>
            ) : isMultiSlot ? (
              /* Multi-select: checkboxes */
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {eligibleMinisters.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                      selectedMinisterIds.has(m.id) && "bg-teal-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMinisterIds.has(m.id)}
                      onChange={() => toggleMinister(m.id)}
                      className="accent-teal-700 h-4 w-4 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{fullName(m)}</p>
                      {m.email && (
                        <p className="text-xs text-slate-400">{m.email}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : isQuickMode ? (
              /* Single-slot quick: tap to assign immediately */
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {eligibleMinisters.map((m) => (
                  <button
                    key={m.id}
                    disabled={isPending}
                    onClick={() => handleAssignSingle(m.id)}
                    className="flex items-center justify-between w-full px-3 py-3 text-left transition-colors disabled:opacity-50 hover:bg-teal-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">{fullName(m)}</p>
                      {m.email && (
                        <p className="text-xs text-slate-400">{m.email}</p>
                      )}
                    </div>
                    <span className="ml-3 text-xs font-semibold text-teal-600 flex-shrink-0">
                      {isPending ? "…" : "Assign →"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* Single-slot standard: radio buttons + Assign button */
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {eligibleMinisters.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                      selectedMinisterId === m.id && "bg-teal-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="minister"
                      value={m.id}
                      checked={selectedMinisterId === m.id}
                      onChange={() => setSelectedMinisterId(m.id)}
                      className="accent-navy-700"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{fullName(m)}</p>
                      {m.email && (
                        <p className="text-xs text-slate-400">{m.email}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
          )}
        </div>

        {/* Footer */}
        {isQuickMode && !isMultiSlot ? (
          /* Single-slot quick mode: just cancel */
          <div className="border-t border-slate-100 px-5 py-3 text-center">
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : isMultiSlot ? (
          /* Multi-select: cancel + assign */
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignMultiple}
              disabled={isPending || selectedMinisterIds.size === 0}
              className={cn(
                "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white",
                "hover:bg-teal-600 transition-colors",
                (isPending || selectedMinisterIds.size === 0) && "opacity-60 cursor-not-allowed"
              )}
            >
              {isPending
                ? "Saving…"
                : selectedMinisterIds.size > 1
                ? `Assign ${selectedMinisterIds.size} Ministers`
                : "Assign"}
            </button>
          </div>
        ) : (
          /* Single-slot standard: remove + cancel + assign */
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <div>
              {existingAssignment && (
                <button
                  onClick={handleRemove}
                  disabled={isPending}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  Remove assignment
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignSingle()}
                disabled={isPending || eligibleMinisters.length === 0}
                className={cn(
                  "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white",
                  "hover:bg-teal-600 transition-colors",
                  (isPending || eligibleMinisters.length === 0) && "opacity-60 cursor-not-allowed"
                )}
              >
                {isPending ? "Saving…" : "Assign"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
