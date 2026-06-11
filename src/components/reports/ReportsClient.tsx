"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { MassReportData, MassReportRow } from "@/lib/reports";
import { cn } from "@/lib/utils";

type SortKey = "date" | "time" | "typeLabel" | "languageLabel" | "statusLabel" | "staffingLabel";
type SortDirection = "asc" | "desc";
type ReportFilter = "celebrated" | "scheduled" | "all";

interface ReportsClientProps {
  report: MassReportData;
  range: string;
  startDate: string;
  endDate: string;
  today: string;
}

interface LocalSummary {
  totalCelebrated: number;
  cancelled: number;
  massCount: number;
  liturgicalServiceCount: number;
  byCategory: { label: string; count: number; items: { label: string; count: number }[] }[];
  byType: { label: string; count: number }[];
  byLanguage: { label: string; count: number }[];
  byWeek: { label: string; count: number }[];
  unfilledCount: number;
  unfilledPercent: number;
  priestAssigned: number;
  priestUnassigned: number;
  priestCoveragePercent: number;
}

const FILTER_LABELS: Record<ReportFilter, string> = {
  celebrated: "Celebrated",
  scheduled: "Scheduled",
  all: "All",
};

export function ReportsClient({ report, range, startDate, endDate, today }: ReportsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filter, setFilter] = useState<ReportFilter>("celebrated");

  const filteredRows = useMemo(
    () => filterRows(report.rows, filter, today),
    [filter, report.rows, today]
  );

  const summary = useMemo(() => summarizeRows(filteredRows), [filteredRows]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const result = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredRows, sortDirection, sortKey]);

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

      <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
        {(Object.keys(FILTER_LABELS) as ReportFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
              filter === item ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {FILTER_LABELS[item]}
          </button>
        ))}
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Celebrations" value={summary.totalCelebrated} />
        <SummaryCard label="Cancelled" value={summary.cancelled} tone="green" />
        <SummaryCard label="Masses" value={summary.massCount} />
        <SummaryCard label="Liturgical Services" value={summary.liturgicalServiceCount} />
        <SummaryCard
          label="Unfilled Required Roles"
          value={`${summary.unfilledCount} (${summary.unfilledPercent}%)`}
        />
        <SummaryCard
          label="Priest Coverage"
          value={`${summary.priestCoveragePercent}%`}
          subtext={`${summary.priestAssigned} assigned, ${summary.priestUnassigned} unassigned`}
        />
        <BreakdownCard label="Mass vs Liturgical Service" groups={summary.byCategory} />
        <BreakdownCard label="Mass Type" items={summary.byType} />
        <BreakdownCard label="Language" items={summary.byLanguage} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <BarChart title="Mass Count by Type" data={summary.byType} />
        <PieChart title="Mass Count by Language" data={summary.byLanguage} />
        <LineChart title="Masses per Week" data={summary.byWeek} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Masses</h2>
            <p className="text-sm text-slate-500">{sortedRows.length} item{sortedRows.length === 1 ? "" : "s"} in view</p>
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
                    No Masses found in this view.
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

function filterRows(rows: MassReportRow[], filter: ReportFilter, today: string) {
  if (filter === "celebrated") {
    return rows.filter((row) => row.date <= today && row.status !== "CANCELLED");
  }
  if (filter === "scheduled") {
    return rows.filter((row) => row.date > today);
  }
  return rows;
}

function summarizeRows(rows: MassReportRow[]): LocalSummary {
  const activeRows = rows.filter((row) => row.status !== "CANCELLED");
  const byCategory = mapCounts(countBy(activeRows, (row) => row.categoryLabel)).map((category) => ({
    ...category,
    items: mapCounts(countBy(activeRows.filter((row) => row.categoryLabel === category.label), (row) => row.typeLabel)),
  }));
  const unfilledCount = activeRows.filter((row) => row.staffingStatus !== "GREEN").length;
  const priestAssigned = activeRows.filter((row) => row.hasPriest).length;
  const priestUnassigned = activeRows.length - priestAssigned;

  return {
    totalCelebrated: activeRows.length,
    cancelled: rows.length - activeRows.length,
    massCount: activeRows.filter((row) => row.categoryLabel === "Mass").length,
    liturgicalServiceCount: activeRows.filter((row) => row.categoryLabel === "Liturgical Service").length,
    byCategory,
    byType: mapCounts(countBy(activeRows, (row) => row.typeLabel)),
    byLanguage: mapCounts(countBy(activeRows, (row) => row.languageLabel)),
    byWeek: mapCounts(countBy(activeRows, (row) => weekLabel(row.date))).sort((a, b) => a.label.localeCompare(b.label)),
    unfilledCount,
    unfilledPercent: percent(unfilledCount, activeRows.length),
    priestAssigned,
    priestUnassigned,
    priestCoveragePercent: percent(priestAssigned, activeRows.length),
  };
}

function SummaryCard({
  label,
  value,
  subtext,
  tone = "default",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: "default" | "green";
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-white p-4",
      tone === "green" ? "border-green-200" : "border-slate-200"
    )}>
      <div className={cn(
        "text-xs font-semibold uppercase tracking-wide",
        tone === "green" ? "text-green-700" : "text-slate-500"
      )}>{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}

function BreakdownCard({
  label,
  items,
  groups,
}: {
  label: string;
  items?: { label: string; count: number }[];
  groups?: { label: string; count: number; items: { label: string; count: number }[] }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-3 space-y-2">
        {groups ? (
          groups.length === 0 ? (
            <p className="text-sm text-slate-500">No Masses</p>
          ) : groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">{group.label}</span>
                <span className="font-semibold text-slate-900">{group.count}</span>
              </div>
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 pl-3 text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          ))
        ) : !items || items.length === 0 ? (
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

function BarChart({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <ChartFrame title={title} empty={data.length === 0}>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="grid grid-cols-[minmax(90px,1fr)_2fr_32px] items-center gap-2 text-xs">
            <span className="truncate text-slate-600" title={item.label}>{item.label}</span>
            <div className="h-3 rounded bg-slate-100">
              <div className="h-3 rounded bg-navy-700" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-800">{item.count}</span>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

function PieChart({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let running = 0;

  return (
    <ChartFrame title={title} empty={data.length === 0}>
      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-28 w-28">
          <circle cx="60" cy="60" r="42" fill="#f1f5f9" />
          {data.map((item, index) => {
            const start = running / total;
            running += item.count;
            const end = running / total;
            return (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r="42"
                fill="transparent"
                stroke={chartColor(index)}
                strokeWidth="28"
                strokeDasharray={`${Math.max(0.01, end - start) * 263.89} 263.89`}
                strokeDashoffset={`${-start * 263.89}`}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColor(index) }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold text-slate-800">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

function LineChart({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 150 : 20 + (index / (data.length - 1)) * 260;
    const y = 100 - (item.count / max) * 76;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <ChartFrame title={title} empty={data.length === 0}>
      <svg viewBox="0 0 300 130" className="h-36 w-full">
        <line x1="20" y1="102" x2="282" y2="102" stroke="#cbd5e1" />
        <line x1="20" y1="18" x2="20" y2="102" stroke="#cbd5e1" />
        <path d={path} fill="none" stroke="#0f3b5f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="#0f3b5f" />
            <text x={point.x} y={point.y - 8} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
              {point.count}
            </text>
            <text x={point.x} y="122" textAnchor="middle" className="fill-slate-500 text-[9px]">
              {shortDate(point.label)}
            </text>
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

function ChartFrame({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 min-h-32">
        {empty ? <p className="text-sm text-slate-500">No Masses</p> : children}
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

function countBy(rows: MassReportRow[], getKey: (row: MassReportRow) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(getKey(row), (counts.get(getKey(row)) ?? 0) + 1);
  return counts;
}

function mapCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function percent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function weekLabel(date: string) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - value.getDay());
  return value.toISOString().slice(0, 10);
}

function shortDate(date: string) {
  return date.slice(5);
}

function chartColor(index: number) {
  const colors = ["#0f3b5f", "#2f7d6d", "#b7791f", "#7f1d1d", "#475569", "#6d28d9"];
  return colors[index % colors.length];
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
