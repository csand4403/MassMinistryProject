"use client";

import { useTransition } from "react";
import { setMassTimeStatus } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { MassStatus } from "@/types";

export function MassStatusButton({
  massTimeId,
  date,
  status,
  size = "sm",
}: {
  massTimeId: string;
  date: string;
  status: MassStatus;
  size?: "xs" | "sm";
}) {
  const [isPending, startTransition] = useTransition();
  const isCancelled = status === "CANCELLED";
  const nextStatus: MassStatus = isCancelled ? "SCHEDULED" : "CANCELLED";

  const handleClick = () => {
    if (!isCancelled) {
      const confirmed = window.confirm(
        "Cancel this Mass? It will stay on the calendar as Cancelled, stop counting toward alerts, and can be restored with Uncancel."
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      await setMassTimeStatus(massTimeId, date, nextStatus);
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className={cn(
        "rounded font-semibold ring-1 transition-colors disabled:opacity-60",
        size === "xs" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        isCancelled
          ? "bg-white text-navy-700 ring-navy-200 hover:bg-navy-50"
          : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {isPending ? "Saving..." : isCancelled ? "Uncancel" : "Cancel this Mass"}
    </button>
  );
}
