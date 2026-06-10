"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface MonthNavProps {
  year: number;
  month: number; // 1-based
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getPrevMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function getNextMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export function MonthNav({ year, month }: MonthNavProps) {
  const prev = getPrevMonth(year, month);
  const next = getNextMonth(year, month);

  return (
    <div className="flex items-center justify-between mb-4">
      <Link
        href={`/?year=${prev.year}&month=${prev.month}`}
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium",
          "text-navy-700 hover:bg-navy-100 transition-colors focus-ring"
        )}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {MONTH_NAMES[prev.month - 1]}
      </Link>

      <h2 className="text-xl font-bold text-navy-900">
        {MONTH_NAMES[month - 1]} {year}
      </h2>

      <Link
        href={`/?year=${next.year}&month=${next.month}`}
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium",
          "text-navy-700 hover:bg-navy-100 transition-colors focus-ring"
        )}
      >
        {MONTH_NAMES[next.month - 1]}
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}
