import { createClient } from "@/lib/supabase/server";
import { getCalendarMonth, getUpcomingAlerts } from "@/lib/queries";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { MonthNav } from "@/components/calendar/MonthNav";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { AlertBanner } from "@/components/calendar/AlertBanner";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

  const supabase = await createClient();
  const [days, alerts] = await Promise.all([
    getCalendarMonth(supabase, year, month),
    getUpcomingAlerts(supabase),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Ministry Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Click any Sunday or feast day to view Mass assignments
        </p>
      </div>

      <AlertBanner alerts={alerts} />

      <MonthNav year={year} month={month} />
      <CalendarGrid year={year} month={month} days={days} />
      <CalendarLegend />
    </div>
  );
}
