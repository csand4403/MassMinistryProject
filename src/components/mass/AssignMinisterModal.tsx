"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import { createAssignment, deleteAssignment } from "@/lib/actions";
import { ROLE_LABELS } from "@/types";
import type { Minister, MinisterRole, Assignment } from "@/types";

interface AssignMinisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  massTimeId: string;
  role: MinisterRole;
  existingAssignment?: Assignment & { minister: Minister };
  /** Ministers already qualified for this role */
  eligibleMinisters: Minister[];
  /**
   * Quick-assign mode: clicking a minister name immediately assigns without
   * a separate confirm step. Used for unfilled/empty slots.
   */
  quickMode?: boolean;
}

/**
 * Modal dialog for assigning or replacing a minister in a role slot.
 * Handles both creation (no existing) and replacement (delete + create).
 * In quickMode (unfilled slots), clicking a minister assigns them instantly.
 */
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
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  /** Assign the given minister (or the selected one in standard mode). */
  const handleAssign = (ministerId?: string) => {
    const id = ministerId ?? selectedMinisterId;
    if (!id) {
      setError("Please select a minister.");
      return;
    }
    setError(null);

    startTransition(async () => {
      // Replace existing assignment if present
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

  const handleRemove = () => {
    if (!existingAssignment) return;
    startTransition(async () => {
      await deleteAssignment(existingAssignment.id);
      router.refresh();
      onClose();
    });
  };

  const isQuickMode = quickMode && !existingAssignment;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {isQuickMode ? "Quick Assign" : "Assign"} {ROLE_LABELS[role]}
            </h2>
            {isQuickMode && (
              <p className="text-xs text-slate-400 mt-0.5">Tap a name to assign immediately</p>
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
          {/* Current assignment note (replace scenario) */}
          {existingAssignment && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              Currently assigned: <strong>{fullName(existingAssignment.minister)}</strong>
              <br />
              <span className="text-xs">Selecting a new minister will replace this assignment.</span>
            </div>
          )}

          {/* Minister list */}
          <div>
            {!isQuickMode && (
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select Minister
              </label>
            )}
            {eligibleMinisters.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No active ministers are qualified for this role.
              </p>
            ) : isQuickMode ? (
              /* Quick-assign: one tap per minister */
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {eligibleMinisters.map((m) => (
                  <button
                    key={m.id}
                    disabled={isPending}
                    onClick={() => handleAssign(m.id)}
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
              /* Standard: radio select + explicit Assign button */
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
        {isQuickMode ? (
          /* Quick-mode: just a cancel link */
          <div className="border-t border-slate-100 px-5 py-3 text-center">
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* Standard mode: remove + cancel + assign buttons */
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
                onClick={() => handleAssign()}
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
