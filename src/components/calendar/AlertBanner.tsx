import Link from "next/link";
import { formatShortDate } from "@/lib/utils";
import type { StaffingAlert } from "@/types";

interface AlertBannerProps {
  alerts: StaffingAlert[];
}

/**
 * Dashboard alert banner showing upcoming Masses with unfilled critical roles.
 * RED (missing Priest) alerts appear first, then YELLOW (roles missing).
 * Each item links directly to the Mass Detail page for immediate action.
 */
export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const redAlerts = alerts.filter((a) => a.status === "RED");
  const yellowAlerts = alerts.filter((a) => a.status === "YELLOW");
  const hasRed = redAlerts.length > 0;

  return (
    <div
      className={`mb-6 rounded-xl overflow-hidden border ${
        hasRed
          ? "border-red-200 bg-red-50"
          : "border-yellow-200 bg-yellow-50"
      }`}
    >
      {/* Banner header */}
      <div
        className={`flex items-center gap-2.5 px-4 py-3 border-b ${
          hasRed
            ? "bg-red-100 border-red-200"
            : "bg-yellow-100 border-yellow-200"
        }`}
      >
        <span className={hasRed ? "text-red-600" : "text-yellow-600"} aria-hidden>
          {hasRed ? "⚠" : "!"}
        </span>
        <div>
          <h2
            className={`text-sm font-bold uppercase tracking-wide ${
              hasRed ? "text-red-800" : "text-yellow-800"
            }`}
          >
            {hasRed ? "Action Required" : "Attention Needed"}
          </h2>
          <p
            className={`text-xs mt-0.5 ${
              hasRed ? "text-red-600" : "text-yellow-700"
            }`}
          >
            {alerts.length} upcoming{" "}
            {alerts.length === 1 ? "Mass has" : "Masses have"} unfilled roles
          </p>
        </div>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-red-100">
        {alerts.map((alert) => (
          <Link
            key={`${alert.date}-${alert.mass_time_id}`}
            href={`/mass/${alert.date}/${alert.mass_time_id}`}
            className={`flex items-center justify-between px-4 py-3 transition-colors group ${
              alert.status === "RED"
                ? "hover:bg-red-100"
                : "hover:bg-yellow-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status dot */}
              <span
                className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                  alert.status === "RED" ? "bg-red-500" : "bg-yellow-400"
                }`}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    alert.status === "RED" ? "text-red-800" : "text-yellow-800"
                  }`}
                >
                  {formatShortDate(alert.date)} &middot; {alert.time_label}
                  <span
                    className={`ml-2 text-xs font-normal ${
                      alert.status === "RED" ? "text-red-500" : "text-yellow-600"
                    }`}
                  >
                    {alert.display_name}
                  </span>
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    alert.status === "RED" ? "text-red-600" : "text-yellow-700"
                  }`}
                >
                  {alert.missing_priest
                    ? "No Priest assigned — Mass cannot proceed without one"
                    : "Some roles are unfilled"}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold flex-shrink-0 ml-3 transition-colors ${
                alert.status === "RED"
                  ? "text-red-400 group-hover:text-red-700"
                  : "text-yellow-500 group-hover:text-yellow-800"
              }`}
            >
              Assign →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
