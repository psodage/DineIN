import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, backTo = -1 }) {
  const navigate = useNavigate();

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => (typeof backTo === "string" ? navigate(backTo) : navigate(backTo))}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-ink transition hover:bg-slate-200"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-ink">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}
