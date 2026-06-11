"use client";

import { useState } from "react";
import Link from "next/link";
import { formatShortDate } from "@/lib/utils";
import type { StaffingAlert, CelebrantAlert } from "@/types";

interface AlertBannerProps {
  staffingAlerts: StaffingAlert[];
  celebrantAlerts: CelebrantAlert[];
}

export function AlertBanner({ staffingAlerts, celebrantAlerts }: AlertBannerProps) {
  const hasStaffing = staffingAlerts.length > 0;
  const hasCelebrant = celebrantAlerts.length > 0;

  if (!hasStaffing && !hasCelebrant) return null;

  return (
    <div className="mb-6 space-y-3">
      {hasStaffing && (
        <StaffingAlertSection alerts={staffingAlerts} />
      )}
      {hasCelebrant && (
        <CelebrantAlertSection alerts={celebrantAlerts} />
      )}
    </div>
  );
}

function StaffingAlertSection({ alerts }: { alerts: StaffingAlert[] }) {
  const [open, setOpen] = useState(false);
  const hasRed = alerts.some((a) => a.status === "RED");
  const redCount = alerts.filter((a) => a.status === "RED").length;
  const yellowCount = alerts.filter((a) => a.status === "YELLOW").length;

  const colorClasses = hasRed
    ? { border: "border-red-200", bg: "bg-red-50", hdr: "bg-red-100", hdrBorder: "border-red-200", title: "text-red-800", sub: "text-red-600", icon: "text-red-600", divider: "divide-red-100" }
    : { border: "border-yellow-200", bg: "bg-yellow-50", hdr: "bg-yellow-100", hdrBorder: "border-yellow-200", title: "text-yellow-800", sub: "text-yellow-700", icon: "text-yellow-600", divider: "divide-yellow-100" };

  const summaryParts: string[] = [];
  if (redCount > 0) summaryParts.push(`${redCount} critical`);
  if (yellowCount > 0) summaryParts.push(`${yellowCount} incomplete`);

  return (
    <div className={`rounded-xl overflow-hidden border ${colorClasses.border} ${colorClasses.bg}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 border-b ${colorClasses.hdr} ${colorClasses.hdrBorder} text-left`}
      >
        <div className="flex items-center gap-2.5">
          <span className={colorClasses.icon} aria-hidden>{hasRed ? "⚠" : "!"}</span>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-wide ${colorClasses.title}`}>
              {hasRed ? "Action Required" : "Attention Needed"}
            </h2>
            <p className={`text-xs mt-0.5 ${colorClasses.sub}`}>
              Next 7 days &mdash; {summaryParts.join(", ")} ({alerts.length} {alerts.length === 1 ? "Mass" : "Masses"} with unfilled roles)
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold flex-shrink-0 ${colorClasses.sub}`}>
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {open && (
        <div className={`divide-y ${colorClasses.divider}`}>
          {alerts.map((alert) => (
            <Link
              key={`${alert.date}-${alert.mass_time_id}`}
              href={`/mass/${alert.date}/${alert.mass_time_id}`}
              className={`flex items-center justify-between px-4 py-3 transition-colors group ${
                alert.status === "RED" ? "hover:bg-red-100" : "hover:bg-yellow-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                    alert.status === "RED" ? "bg-red-500" : "bg-yellow-400"
                  }`}
                />
                <div>
                  <p className={`text-sm font-semibold ${alert.status === "RED" ? "text-red-800" : "text-yellow-800"}`}>
                    {formatShortDate(alert.date)} &middot; {alert.time_label}
                    <span className={`ml-2 text-xs font-normal ${alert.status === "RED" ? "text-red-500" : "text-yellow-600"}`}>
                      {alert.display_name}
                    </span>
                  </p>
                  <p className={`text-xs mt-0.5 ${alert.status === "RED" ? "text-red-600" : "text-yellow-700"}`}>
                    {alert.missing_priest
                      ? "No Priest assigned — Mass cannot proceed without one"
                      : "Some roles are unfilled"}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-semibold flex-shrink-0 ml-3 transition-colors ${
                alert.status === "RED"
                  ? "text-red-400 group-hover:text-red-700"
                  : "text-yellow-500 group-hover:text-yellow-800"
              }`}>
                Assign →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CelebrantAlertSection({ alerts }: { alerts: CelebrantAlert[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-orange-200 bg-orange-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2.5 px-4 py-3 border-b bg-orange-100 border-orange-200 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-orange-600" aria-hidden>⚑</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-orange-800">
              Letter of Suitability
            </h2>
            <p className="text-xs mt-0.5 text-orange-700">
              {alerts.length} visiting celebrant{alerts.length !== 1 ? "s" : ""} with a documentation issue
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold flex-shrink-0 text-orange-600">
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-orange-100">
          {alerts.map((alert, i) => (
            <Link
              key={`celebrant-${i}`}
              href={`/mass/${alert.date}/${alert.mass_time_id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-orange-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0 bg-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    {formatShortDate(alert.date)} &middot; {alert.time_label}
                    <span className="ml-2 text-xs font-normal text-orange-600">
                      {alert.display_name}
                    </span>
                  </p>
                  <p className="text-xs mt-0.5 text-orange-700">
                    {alert.minister_name} —{" "}
                    {alert.warning === "missing_letter"
                      ? "Letter of Suitability not on file"
                      : "Letter of Suitability is expired"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold flex-shrink-0 ml-3 text-orange-400 group-hover:text-orange-700 transition-colors">
                Review →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
