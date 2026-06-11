"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getDayOfMonth } from "@/lib/utils";
import { STATUS_DOT_CLASSES, STATUS_LABELS } from "@/lib/staffing";
import { LANGUAGE_SHORT } from "@/types";
import type { CalendarDayStatus } from "@/types";
import { startOfMonth, getDay } from "date-fns";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  year: number;
  month: number;
  days: CalendarDayStatus[];
}

export function CalendarGrid({ year, month, days }: CalendarGridProps) {
  const router = useRouter();

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const startPadding = getDay(monthStart);

  const handleDayClick = (day: CalendarDayStatus) => {
    if (!day.is_sunday && !day.liturgical_date_id) return;
    router.push(`/mass/${day.date}`);
  };

  return (
    <div className="parish-card overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="h-20 border-b border-r border-slate-100 bg-slate-50/50" />
        ))}

        {days.map((day) => {
          const dayNum = getDayOfMonth(day.date);
          const isActive = day.is_sunday || !!day.liturgical_date_id;
          const isHolyDay = day.is_feast_or_holy_day;

          return (
            <div
              key={day.date}
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-20 border-b border-r border-slate-100 p-1.5 flex flex-col",
                isActive && "cursor-pointer",
                isActive && !isHolyDay && "hover:bg-navy-50 transition-colors",
                isHolyDay && "bg-parish-50 hover:bg-parish-100 transition-colors",
                !isActive && "bg-slate-50/50 opacity-50"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "text-sm font-semibold self-start leading-none",
                  day.is_sunday ? "text-navy-800" : "text-slate-600",
                  !isActive && "text-slate-400"
                )}
              >
                {dayNum}
              </span>

              {/* Feast name */}
              {day.feast_name && (
                <span className="mt-0.5 text-[10px] leading-tight text-parish-700 font-medium line-clamp-2">
                  {day.feast_name}
                </span>
              )}

              {/* HOD badge */}
              {day.is_holy_day_of_obligation && (
                <span className="mt-auto text-[9px] font-bold uppercase tracking-wide text-parish-600">
                  HOD
                </span>
              )}

              {/* Status dot + language tags */}
              {isActive && day.status && (
                <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full flex-shrink-0",
                      STATUS_DOT_CLASSES[day.status]
                    )}
                    title={STATUS_LABELS[day.status]}
                  />
                  {day.languages.map((lang) => (
                    <span
                      key={lang}
                      className="text-[9px] font-semibold text-slate-400 leading-none"
                      title={lang}
                    >
                      {LANGUAGE_SHORT[lang]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
