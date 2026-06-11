import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMinister } from "@/lib/queries";
import { fullName } from "@/lib/utils";
import { ROLE_LABELS, ROLE_SHORT_LABELS } from "@/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MinisterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const minister = await getMinister(supabase, id);
  if (!minister) notFound();

  const name = fullName(minister);

  // Fetch upcoming assignments for this minister
  const { data: assignments } = await supabase
    .from("assignment")
    .select(`
      id, role, reading_label, status,
      mass_time (
        id, time_label, display_name,
        liturgical_date (date, feast_name, season)
      )
    `)
    .eq("minister_id", id)
    .neq("status", "ABSENT")
    .order("created_at", { ascending: false })
    .limit(20);

  // Filter to upcoming (today or future)
  const today = new Date().toISOString().split("T")[0];
  const upcoming = (assignments ?? []).filter(
    (a: any) => a.mass_time?.liturgical_date?.date >= today
  );

  return (
    <div>
      <Link
        href="/ministers"
        className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-800 transition-colors mb-4"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Ministers
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-700 font-bold text-xl">
            {name[0]}{minister.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{name}</h1>
            {!minister.is_active && (
              <span className="text-xs font-bold uppercase text-slate-400 ring-1 ring-slate-200 rounded px-1.5 py-0.5">
                Inactive
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/ministers/${id}/edit`}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Edit
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Contact card */}
        <div className="parish-card p-5">
          <h2 className="section-header mb-4">
            <span className="h-4 w-1 rounded-full bg-navy-700" />
            Contact
          </h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Email" value={minister.email} />
            <InfoRow label="Phone" value={minister.phone} />
            <InfoRow
              label="Notifications"
              value={notifLabel(minister.notification_preference)}
            />
            {minister.notes && (
              <InfoRow label="Notes" value={minister.notes} />
            )}
          </dl>
        </div>

        {/* Roles card */}
        <div className="parish-card p-5">
          <h2 className="section-header mb-4">
            <span className="h-4 w-1 rounded-full bg-navy-700" />
            Qualified Roles
          </h2>
          <div className="flex flex-wrap gap-2">
            {minister.roles.map((role) => (
              <span
                key={role}
                className="rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-700 ring-1 ring-navy-100"
              >
                {ROLE_LABELS[role]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming assignments */}
      <div className="parish-card p-5 mt-5">
        <h2 className="section-header mb-4">
          <span className="h-4 w-1 rounded-full bg-navy-700" />
          Upcoming Assignments
        </h2>

        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No upcoming assignments found.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a: any) => {
              const date: string = a.mass_time?.liturgical_date?.date ?? "";
              const massTimeId: string = a.mass_time?.id ?? "";
              return (
                <Link
                  key={a.id}
                  href={`/mass/${date}/${massTimeId}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-700">
                      {a.mass_time?.liturgical_date?.feast_name
                        ? a.mass_time.liturgical_date.feast_name
                        : formatDateShort(date)}
                    </span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-500">{a.mass_time?.time_label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {ROLE_SHORT_LABELS[a.role as keyof typeof ROLE_SHORT_LABELS]}
                    </span>
                    <StatusDot status={a.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 flex-shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value ?? <span className="italic text-slate-300">—</span>}</dd>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SCHEDULED:  "bg-slate-400",
    CONFIRMED:  "bg-blue-500",
    PENDING:    "bg-amber-500",
    DECLINED:   "bg-red-500",
    CHECKED_IN: "bg-green-500",
    ABSENT:     "bg-red-500",
  };
  return (
    <span
      className={cn("h-2 w-2 rounded-full flex-shrink-0", colors[status] ?? "bg-slate-300")}
      title={status}
    />
  );
}

function notifLabel(pref: string) {
  return {
    email: "Email",
    sms: "SMS",
    both: "Email + SMS",
    none: "None",
  }[pref] ?? pref;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
