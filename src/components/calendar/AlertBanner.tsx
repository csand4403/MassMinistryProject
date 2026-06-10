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

  const hasRed = staffingAlerts.some((a) => a.status === "RED");

  return (
    <div className="mb-6 space-y-3">
      {/* Staffing alerts */}
      {hasStaffing && (
        <div
          className={`rounded-xl overflow-hidden border ${
            hasRed ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
          }`}
        >
          <div
            className={`flex items-center gap-2.5 px-4 py-3 border-b ${
              hasRed ? "bg-red-100 border-red-200" : "bg-yellow-100 border-yellow-200"
            }`}
          >
            <span className={hasRed ? "text-red-600" : "text-yellow-600"} aria-hidden>
              {hasRed ? "⚠" : "!"}
            </span>
            <div>
              <h2 className={`text-sm font-bold uppercase tracking-wide ${hasRed ? "text-red-800" : "text-yellow-800"}`}>
                {hasRed ? "Action Required" : "Attention Needed"}
              </h2>
              <p className={`text-xs mt-0.5 ${hasRed ? "text-red-600" : "text-yellow-700"}`}>
                {staffingAlerts.length} upcoming{" "}
                {staffingAlerts.length === 1 ? "Mass has" : "Masses have"} unfilled roles
              </p>
            </div>
          </div>

          <div className="divide-y divide-red-100">
            {staffingAlerts.map((alert) => (
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
        </div>
      )}

      {/* Visiting celebrant letter warnings */}
      {hasCelebrant && (
        <div className="rounded-xl overflow-hidden border border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-orange-100 border-orange-200">
            <span className="text-orange-600" aria-hidden>⚑</span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-orange-800">
                Letter of Suitability
              </h2>
              <p className="text-xs mt-0.5 text-orange-700">
                {celebrantAlerts.length} visiting celebrant{celebrantAlerts.length !== 1 ? "s" : ""} with a documentation issue
              </p>
            </div>
          </div>

          <div className="divide-y divide-orange-100">
            {celebrantAlerts.map((alert, i) => (
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
        </div>
      )}
    </div>
  );
}
