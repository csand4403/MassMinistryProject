import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMinisters } from "@/lib/queries";
import { MinisterCard } from "@/components/ministers/MinisterCard";
import type { MinisterRole } from "@/types";
import { ROLE_SHORT_LABELS } from "@/types";

interface PageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function MinistersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const roleFilter = params.role as MinisterRole | undefined;

  const supabase = await createClient();
  let ministers = await getMinisters(supabase);

  // Client-side filter by role if provided
  if (roleFilter) {
    ministers = ministers.filter((m) => m.roles.includes(roleFilter));
  }

  const allRoles = Object.entries(ROLE_SHORT_LABELS) as [MinisterRole, string][];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Ministers</h1>
          <p className="text-sm text-slate-500 mt-1">
            {ministers.length} active minister{ministers.length !== 1 ? "s" : ""}
            {roleFilter ? ` qualified as ${ROLE_SHORT_LABELS[roleFilter]}` : ""}
          </p>
        </div>

        <Link
          href="/ministers/new"
          className="flex items-center gap-1.5 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 transition-colors focus-ring"
        >
          <PlusIcon className="h-4 w-4" />
          Add Minister
        </Link>
      </div>

      {/* Role filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href="/ministers"
          className={chipClass(!roleFilter)}
        >
          All
        </Link>
        {allRoles.map(([role, label]) => (
          <Link
            key={role}
            href={`/ministers?role=${role}`}
            className={chipClass(roleFilter === role)}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Minister list */}
      {ministers.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
          <p className="text-base font-medium">No ministers found</p>
          <p className="text-sm mt-1">
            {roleFilter
              ? `No active ministers are qualified as ${ROLE_SHORT_LABELS[roleFilter]}.`
              : "Add your first minister to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ministers.map((m) => (
            <MinisterCard key={m.id} minister={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors ring-1 ${
    active
      ? "bg-navy-800 text-white ring-navy-800"
      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
  }`;
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
