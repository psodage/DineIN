import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMonthLabel } from "@/lib/monthLabels";

export default function MonthNavigator({
  yearMonth,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  language = "en",
}) {
  const label = getMonthLabel(yearMonth, language);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        aria-label="Next month"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
