import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { normalizeRole } from "@/lib/staffing";
import { formatDate } from "@/lib/utils";
import { AssignmentResponseButtons } from "@/components/my-schedule/AssignmentResponseButtons";
import {
  MASS_TYPE_LABELS,
  ROLE_SHORT_LABELS,
  type AssignmentStatus,
  type MassType,
  type MinisterRole,
} from "@/types";

interface MyAssignmentRow {
  id: string;
  role: MinisterRole | "LECTOR_1" | "LECTOR_2";
  reading_label: string | null;
  status: AssignmentStatus;
  mass_time: {
    id: string;
    time_label: string;
    display_name: string;
    mass_type: MassType;
    liturgical_date: {
      date: string;
      feast_name: string | null;
    } | null;
  } | null;
}

const STATUS_STYLES: Record<AssignmentStatus, string> = {
  SCHEDULED: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DECLINED: "bg-red-100 text-red-700",
  CHECKED_IN: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  SCHEDULED: "Scheduled",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  CHECKED_IN: "Checked in",
  ABSENT: "Absent",
};

export default async function MySchedulePage() {
  const appUser = await requireRole(["MINISTER"]);
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("assignment")
    .select(`
      id, role, reading_label, status,
      mass_time (
        id, time_label, display_name, mass_type,
        liturgical_date (date, feast_name)
      )
    `)
    .eq("minister_id", appUser.minister_id)
    .neq("status", "ABSENT");

  if (error) throw error;

  const assignments = ((data ?? []) as unknown as MyAssignmentRow[])
    .filter((assignment) => {
      const date = assignment.mass_time?.liturgical_date?.date;
      return date != null && date >= today;
    })
    .sort((a, b) => {
      const left = `${a.mass_time?.liturgical_date?.date ?? ""} ${a.mass_time?.time_label ?? ""}`;
      const right = `${b.mass_time?.liturgical_date?.date ?? ""} ${b.mass_time?.time_label ?? ""}`;
      return left.localeCompare(right);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">My Schedule</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upcoming assignments for {appUser.minister?.first_name ?? "your ministry"}.
        </p>
      </div>

      {assignments.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-800">No upcoming assignments</h2>
          <p className="mt-1 text-sm text-slate-500">New assignments will appear here once scheduled.</p>
        </section>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const massTime = assignment.mass_time!;
            const litDate = massTime.liturgical_date!;
            const normalizedRole = normalizeRole(assignment.role) as MinisterRole;

            return (
              <section
                key={assignment.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {formatDate(litDate.date)}
                      </h2>
                      <span className="text-sm text-slate-400">·</span>
                      <span className="text-sm font-medium text-slate-700">{massTime.time_label}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {litDate.feast_name ?? MASS_TYPE_LABELS[massTime.mass_type]} · {massTime.display_name}
                    </p>
                    <p className="mt-2 text-sm font-medium text-navy-800">
                      {ROLE_SHORT_LABELS[normalizedRole]}
                      {assignment.reading_label ? ` · ${assignment.reading_label}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[assignment.status]}`}>
                      {STATUS_LABELS[assignment.status]}
                    </span>
                    <AssignmentResponseButtons assignmentId={assignment.id} status={assignment.status} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
