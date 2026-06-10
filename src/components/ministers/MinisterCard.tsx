import Link from "next/link";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/utils";
import { ROLE_SHORT_LABELS } from "@/types";
import type { Minister } from "@/types";

interface MinisterCardProps {
  minister: Minister;
}

export function MinisterCard({ minister }: MinisterCardProps) {
  const name = fullName(minister);
  const initials = `${minister.first_name[0]}${minister.last_name[0]}`.toUpperCase();

  return (
    <Link
      href={`/ministers/${minister.id}`}
      className="parish-card flex items-start gap-4 p-4 hover:shadow-md transition-shadow group focus-ring"
    >
      {/* Avatar */}
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-700 font-bold text-sm">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + active status */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-800 group-hover:text-navy-700 transition-colors truncate">
            {name}
          </h3>
          {!minister.is_active && (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase text-slate-400 ring-1 ring-slate-200 rounded px-1">
              Inactive
            </span>
          )}
        </div>

        {/* Contact */}
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {minister.email ?? minister.phone ?? "No contact info"}
        </p>

        {/* Role tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {minister.roles.map((role) => (
            <span
              key={role}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                getRoleTagClass(role)
              )}
            >
              {ROLE_SHORT_LABELS[role]}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function getRoleTagClass(role: string): string {
  switch (role) {
    case "CELEBRANT": return "bg-red-100 text-red-700";
    case "DEACON":    return "bg-orange-100 text-orange-700";
    case "LECTOR":
    case "LECTOR_1":
    case "LECTOR_2":  return "bg-blue-100 text-blue-700";
    case "PSALMIST":  return "bg-violet-100 text-violet-700";
    case "EMHC":      return "bg-green-100 text-green-700";
    case "USHER":     return "bg-yellow-100 text-yellow-700";
    case "SECURITY":  return "bg-slate-100 text-slate-600";
    default:          return "bg-slate-100 text-slate-500";
  }
}
