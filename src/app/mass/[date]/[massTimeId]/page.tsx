import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getMassTimeWithRoster,
  getCheckInsForMassTime,
  getLiturgicalDate,
  getMinistersForRole,
} from "@/lib/queries";
import { RoleSectionWithAssign } from "@/components/mass/RoleSectionWithAssign";
import { FeastBanner } from "@/components/mass/FeastBanner";
import { formatDate } from "@/lib/utils";
import { ROLE_DISPLAY_ORDER } from "@/types";
import {
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  STATUS_LABELS,
} from "@/lib/staffing";
import { cn } from "@/lib/utils";
import type { CheckIn, MinisterRole, Minister } from "@/types";

interface PageProps {
  params: Promise<{ date: string; massTimeId: string }>;
}

export default async function MassDetailPage({ params }: PageProps) {
  const { date, massTimeId } = await params;

  const supabase = await createClient();

  const [massTime, checkIns, litDate] = await Promise.all([
    getMassTimeWithRoster(supabase, massTimeId),
    getCheckInsForMassTime(supabase, massTimeId),
    getLiturgicalDate(supabase, date),
  ]);

  if (!massTime) notFound();

  // Fetch eligible ministers for each role in parallel (for the assign modal)
  const eligibleByRole = Object.fromEntries(
    await Promise.all(
      ROLE_DISPLAY_ORDER.map(async (role) => [
        role,
        await getMinistersForRole(supabase, role),
      ])
    )
  ) as Record<MinisterRole, Minister[]>;

  // For Quick Assign (empty slots), exclude ministers already serving at this Mass
  const assignedMinisterIds = new Set(
    massTime.assignments
      .filter((a) => a.status !== "ABSENT")
      .map((a) => a.minister_id)
  );

  // Build a map of assignment_id → check_in for O(1) lookup
  const checkInMap = new Map<string, CheckIn>(
    checkIns.map((ci) => [ci.assignment_id, ci])
  );

  // Group assignments by role
  const byRole = new Map<string, typeof massTime.assignments>();
  for (const role of ROLE_DISPLAY_ORDER) {
    byRole.set(role, massTime.assignments.filter((a) => a.role === role));
  }

  const { staffing_status } = massTime;

  // Count checked-in vs total assigned (excluding absent)
  const activeAssignments = massTime.assignments.filter(
    (a) => a.status !== "ABSENT"
  );
  const checkedInCount = activeAssignments.filter(
    (a) => a.status === "CHECKED_IN" || checkInMap.has(a.id)
  ).length;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
        <Link href="/" className="hover:text-navy-700 transition-colors">Calendar</Link>
        <ChevronIcon />
        <Link href={`/mass/${date}`} className="hover:text-navy-700 transition-colors">
          {formatDate(date)}
        </Link>
        <ChevronIcon />
        <span className="text-slate-700 font-medium">{massTime.time_label}</span>
      </nav>

      {/* Header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">
              {massTime.time_label} — {massTime.display_name}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{formatDate(date)}</p>
          </div>

          {/* Staffing status */}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1",
              STATUS_BADGE_CLASSES[staffing_status]
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_DOT_CLASSES[staffing_status]
              )}
            />
            {STATUS_LABELS[staffing_status]}
          </span>
        </div>

        {/* Check-in progress bar */}
        {activeAssignments.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Check-in progress</span>
              <span className="font-medium">
                {checkedInCount} / {activeAssignments.length} arrived
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${(checkedInCount / activeAssignments.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feast banner */}
      {litDate && (litDate.feast_name || litDate.is_holy_day_of_obligation) && (
        <div className="mb-5">
          <FeastBanner litDate={litDate} />
        </div>
      )}

      {/* Full Roster */}
      <div className="parish-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-header">
            <span className="h-4 w-1 rounded-full bg-navy-700" />
            Full Ministry Roster
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href={`/mass/${date}/${massTimeId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              title="Open print-ready roster in a new tab"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print Roster
            </Link>
            <p className="text-xs text-slate-400">
              Tap any role to assign or change
            </p>
          </div>
        </div>

        <div className="space-y-5 divide-y divide-slate-100">
          {ROLE_DISPLAY_ORDER.map((role) => {
            const roleAssignments = byRole.get(role) ?? [];
            const qualified = eligibleByRole[role] ?? [];
            // For empty slots (quick assign), filter out already-assigned ministers
            const availableForQuickAssign = roleAssignments.length === 0
              ? qualified.filter((m) => !assignedMinisterIds.has(m.id))
              : qualified;
            return (
              <div key={role} className="pt-5 first:pt-0">
                <RoleSectionWithAssign
                  role={role}
                  massTimeId={massTimeId}
                  assignments={roleAssignments}
                  checkIns={checkInMap}
                  eligibleMinisters={availableForQuickAssign}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-4">
        <Link
          href={`/mass/${date}`}
          className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to {formatDate(date)}
        </Link>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}
