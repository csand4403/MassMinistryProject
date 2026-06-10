import { cn } from "@/lib/utils";
import type { LiturgicalDate } from "@/types";

interface FeastBannerProps {
  litDate: LiturgicalDate;
}

/**
 * Callout banner shown on feast days and Holy Days of Obligation.
 * Uses gold styling for high feasts, violet for Lent, purple for Advent.
 */
export function FeastBanner({ litDate }: FeastBannerProps) {
  if (!litDate.feast_name && !litDate.is_holy_day_of_obligation) return null;

  const isHOD = litDate.is_holy_day_of_obligation;
  const season = litDate.season;

  const bannerColor = cn(
    "rounded-xl border px-4 py-3 flex items-start gap-3",
    season === "LENT" || season === "EASTER_TRIDUUM"
      ? "bg-purple-50 border-purple-200 text-purple-900"
      : season === "ADVENT"
      ? "bg-violet-50 border-violet-200 text-violet-900"
      : "bg-parish-50 border-parish-200 text-parish-900"
  );

  return (
    <div className={bannerColor} role="note" aria-label="Liturgical Feast Information">
      {/* Icon */}
      <span className="text-2xl mt-0.5 flex-shrink-0" aria-hidden="true">
        ✦
      </span>

      <div className="flex-1 min-w-0">
        {litDate.feast_name && (
          <p className="font-bold text-base leading-snug">{litDate.feast_name}</p>
        )}

        {isHOD && (
          <p className="mt-0.5 text-sm font-semibold">
            ⚠ Holy Day of Obligation
            <span className="ml-1 font-normal text-xs opacity-70">
              — Catholics are obligated to attend Mass today
            </span>
          </p>
        )}

        {litDate.notes && (
          <p className="mt-1 text-xs opacity-75">{litDate.notes}</p>
        )}
      </div>
    </div>
  );
}
