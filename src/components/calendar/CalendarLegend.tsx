export function CalendarLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span className="font-semibold text-slate-600 uppercase tracking-wide">Legend:</span>

      <LegendItem color="bg-green-500" label="All Set" />
      <LegendItem color="bg-yellow-400" label="Needs Attention" />
      <LegendItem color="bg-red-500" label="Critical — Act Now" />

      <div className="h-4 w-px bg-slate-300" />

      <div className="flex items-center gap-1">
        <span className="inline-block rounded bg-parish-50 border border-parish-200 px-1 py-0.5 text-[10px] font-bold text-parish-600">
          HOD
        </span>
        <span>Holy Day of Obligation</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
