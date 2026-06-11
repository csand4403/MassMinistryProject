"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MassReportData, MassReportRow } from "@/lib/reports";
import { cn } from "@/lib/utils";

type SortKey = "date" | "time" | "typeLabel" | "languageLabel" | "statusLabel" | "staffingLabel";
type SortDirection = "asc" | "desc";

interface ReportsClientProps {
  report: MassReportData;
  range: string;
  startDate: string;
  endDate: string;
}

export function ReportsClient({ report, range, startDate, endDate }: ReportsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    return [...report.rows].sort((a, b) => {
      const result = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDirection === "asc" ? result : -result;
    });
  }, [report.rows, sortDirection, sortKey]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="space-y-6">
      <form className="rounded-lg border border-slate-200 bg-white p-4" action="/reports">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</span>
            <select
              name="range"
              defaultValue={range}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="this-year">This year</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start</span>
            <input
              type="date"
              name="start"
              defaultValue={startDate}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End</span>
            <input
              type="date"
              name="end"
              defaultValue={endDate}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
          >
            Apply
          </button>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Masses Celebrated" value={report.summary.totalCelebrated} />
        <SummaryCard label="Cancelled Masses" value={report.summary.cancelled} />
        <SummaryCard
          label="Unfilled Required Roles"
          value={`${report.summary.unfilledCount} (${report.summary.unfilledPercent}%)`}
        />
        <SummaryCard
          label="Priest Coverage"
          value={`${report.summary.priestCoveragePercent}%`}
          subtext={`${report.summary.priestAssigned} assigned, ${report.summary.priestUnassigned} unassigned`}
        />
        <BreakdownCard label="Mass Type" items={report.summary.byType} />
        <BreakdownCard label="Language" items={report.summary.byLanguage} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Masses</h2>
            <p className="text-sm text-slate-500">{sortedRows.length} Mass{sortedRows.length === 1 ? "" : "es"} in range</p>
          </div>
          <button
            type="button"
            onClick={() => exportReportCsv(sortedRows, startDate, endDate)}
            className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-navy-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <SortableHeader label="Date" active={sortKey === "date"} direction={sortDirection} onClick={() => changeSort("date")} />
                <SortableHeader label="Time" active={sortKey === "time"} direction={sortDirection} onClick={() => changeSort("time")} />
                <SortableHeader label="Type" active={sortKey === "typeLabel"} direction={sortDirection} onClick={() => changeSort("typeLabel")} />
                <SortableHeader label="Language" active={sortKey === "languageLabel"} direction={sortDirection} onClick={() => changeSort("languageLabel")} />
                <SortableHeader label="Status" active={sortKey === "statusLabel"} direction={sortDirection} onClick={() => changeSort("statusLabel")} />
                <SortableHeader label="Staffing" active={sortKey === "staffingLabel"} direction={sortDirection} onClick={() => changeSort("staffingLabel")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3">
                    <Link href={`/mass/${row.date}/${row.id}`} className="font-medium text-navy-800 hover:underline">
                      {row.date}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.time}</td>
                  <td className="px-3 py-3 text-slate-700">{row.typeLabel}</td>
                  <td className="px-3 py-3 text-slate-700">{row.languageLabel}</td>
                  <td className="px-3 py-3 text-slate-700">{row.statusLabel}</td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      row.staffingStatus === "GREEN" && "bg-green-50 text-green-700",
                      row.staffingStatus === "YELLOW" && "bg-yellow-50 text-yellow-700",
                      row.staffingStatus === "RED" && "bg-red-50 text-red-700"
                    )}>
                      {row.status === "CANCELLED" ? "Cancelled" : row.staffingLabel}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                    No Masses found in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}

function BreakdownCard({ label, items }: { label: string; items: { label: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No Masses</p>
        ) : items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-semibold text-slate-900">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-slate-900">
        {label}
        <span className="text-slate-400">{active ? (direction === "asc" ? "ASC" : "DESC") : "SORT"}</span>
      </button>
    </th>
  );
}

function exportReportCsv(rows: MassReportRow[], startDate: string, endDate: string) {
  const csvRows = [
    ["Date", "Time", "Type", "Language", "Status", "Staffing Status"],
    ...rows.map((row) => [row.date, row.time, row.typeLabel, row.languageLabel, row.statusLabel, row.status === "CANCELLED" ? "Cancelled" : row.staffingLabel]),
  ];
  const csv = csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mass-report-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
