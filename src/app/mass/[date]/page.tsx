import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLiturgicalDateWithMasses } from "@/lib/queries";
import { FeastBanner } from "@/components/mass/FeastBanner";
import { MassCard } from "@/components/mass/MassCard";
import { AddMassForm } from "@/components/mass/AddMassForm";
import { formatDate } from "@/lib/utils";
import { SEASON_LABELS } from "@/types";
import { massTypeForDate } from "@/lib/liturgical-calendar";
import { STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, STATUS_LABELS } from "@/lib/staffing";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function MassDayPage({ params }: PageProps) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const litDateWithMasses = await getLiturgicalDateWithMasses(supabase, date);

  if (!litDateWithMasses) {
    // Date exists but has no liturgical_date record — show empty state
    return (
      <div>
        <BackLink />
        <div className="mt-4 mb-5 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-navy-900">{formatDate(date)}</h1>
          <AddMassForm date={date} defaultMassType={massTypeForDate(date)} />
        </div>
        <div className="mt-8 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
          <p className="text-lg font-medium">No Mass times scheduled for this date.</p>
          <p className="text-sm mt-1">
            This date has not been set up in the liturgical calendar yet.
          </p>
        </div>
      </div>
    );
  }

  const { overall_status, mass_times, season } = litDateWithMasses;
  const activeMassCount = mass_times.filter((mt) => mt.status !== "CANCELLED").length;
  const hasCancelledMass = mass_times.some((mt) => mt.status === "CANCELLED");

  return (
    <div>
      <BackLink />

      {/* Date header */}
      <div className="mt-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-navy-900">{formatDate(date)}</h1>
          {/* Liturgical season chip */}
          <SeasonChip season={season} />
          </div>
          <AddMassForm date={date} defaultMassType={massTypeForDate(date)} />
        </div>

        {/* Overall day status */}
        {activeMassCount > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
              STATUS_BADGE_CLASSES[overall_status]
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_CLASSES[overall_status])} />
            {STATUS_LABELS[overall_status]}
          </span>
        ) : hasCancelledMass ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            All Masses Cancelled
          </span>
        ) : null}
      </div>

      {/* Feast day callout banner */}
      <FeastBanner litDate={litDateWithMasses} />

      {/* Mass time cards */}
      <div className="mt-6">
        <h2 className="section-header mb-3">
          <span className="h-4 w-1 rounded-full bg-navy-700" />
          Mass Times
        </h2>

        {mass_times.length === 0 ? (
          <p className="text-slate-400 italic">No Mass times found for this date.</p>
        ) : (
          <div className="space-y-3">
            {mass_times.map((mt) => (
              <MassCard key={mt.id} massTime={mt} date={date} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-800 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
      Back to Calendar
    </Link>
  );
}

// Liturgical season color chips
const SEASON_CHIP_CLASSES: Record<string, string> = {
  ADVENT:        "bg-violet-100 text-violet-700 ring-violet-200",
  CHRISTMAS:     "bg-yellow-100 text-yellow-700 ring-yellow-200",
  ORDINARY_TIME: "bg-green-100 text-green-700 ring-green-200",
  LENT:          "bg-purple-100 text-purple-700 ring-purple-200",
  EASTER_TRIDUUM:"bg-red-100 text-red-700 ring-red-200",
  EASTER:        "bg-amber-100 text-amber-700 ring-amber-200",
};

function SeasonChip({ season }: { season: string }) {
  const label = SEASON_LABELS[season as keyof typeof SEASON_LABELS] ?? season;
  const cls = SEASON_CHIP_CLASSES[season] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", cls)}>
      {label}
    </span>
  );
}
