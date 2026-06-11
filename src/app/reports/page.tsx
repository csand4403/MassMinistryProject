import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMassReport } from "@/lib/reports";
import { ReportsClient } from "@/components/reports/ReportsClient";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    range?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selected = resolveRange(params);
  const supabase = await createClient();
  const report = await getMassReport(supabase, selected.startDate, selected.endDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Census-style Mass and liturgy reporting for parish planning.
        </p>
      </div>

      <ReportsClient
        report={report}
        range={selected.range}
        startDate={selected.startDate}
        endDate={selected.endDate}
        today={format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}

function resolveRange(params: { range?: string; start?: string; end?: string }) {
  const today = new Date();
  const range = params.range ?? "this-month";

  if (range === "last-month") {
    const month = subMonths(today, 1);
    return {
      range,
      startDate: format(startOfMonth(month), "yyyy-MM-dd"),
      endDate: format(endOfMonth(month), "yyyy-MM-dd"),
    };
  }

  if (range === "this-year") {
    return {
      range,
      startDate: format(startOfYear(today), "yyyy-MM-dd"),
      endDate: format(endOfYear(today), "yyyy-MM-dd"),
    };
  }

  if (range === "custom" && isDate(params.start) && isDate(params.end)) {
    return {
      range,
      startDate: params.start!,
      endDate: params.end!,
    };
  }

  return {
    range: "this-month",
    startDate: format(startOfMonth(today), "yyyy-MM-dd"),
    endDate: format(endOfMonth(today), "yyyy-MM-dd"),
  };
}

function isDate(value?: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}
