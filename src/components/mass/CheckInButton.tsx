"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { checkInMinister, uncheckInMinister } from "@/lib/actions";

interface CheckInButtonProps {
  assignmentId: string;
  isCheckedIn: boolean;
  ministerName: string;
}

/**
 * Toggle button for marking a minister as arrived.
 * Uses an optimistic update so the UI responds immediately.
 */
export function CheckInButton({
  assignmentId,
  isCheckedIn,
  ministerName,
}: CheckInButtonProps) {
  const [optimisticChecked, setOptimisticChecked] = useState(isCheckedIn);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const newValue = !optimisticChecked;
    setOptimisticChecked(newValue);
    setError(null);

    startTransition(async () => {
      const result = newValue
        ? await checkInMinister(assignmentId, "coordinator")
        : await uncheckInMinister(assignmentId);

      if (!result.success) {
        // Revert optimistic update
        setOptimisticChecked(!newValue);
        setError(result.error ?? "Unknown error");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={isPending}
        aria-label={
          optimisticChecked
            ? `Undo check-in for ${ministerName}`
            : `Mark ${ministerName} as arrived`
        }
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          optimisticChecked
            ? "bg-green-100 text-green-700 ring-1 ring-green-300 hover:bg-green-200 focus-visible:ring-green-500"
            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 focus-visible:ring-slate-400",
          isPending && "opacity-60 cursor-not-allowed"
        )}
      >
        {/* Checkbox visual */}
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors flex-shrink-0",
            optimisticChecked
              ? "border-green-500 bg-green-500"
              : "border-slate-300 bg-white"
          )}
        >
          {optimisticChecked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </span>

        <span>
          {optimisticChecked ? "Checked in" : "Mark arrived"}
        </span>

        {isPending && (
          <span className="ml-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
      </button>

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
