export default function Modal({ open, title, children, onClose, actions, type }) {
  if (!open) return null;

  // Auto-detect type from title when not explicitly provided
  const resolvedType = type ?? (() => {
    const t = (title ?? "").toLowerCase();
    if (t.includes("success") || t.includes("यशस्वी")) return "success";
    if (t.includes("error") || t.includes("fail") || t.includes("त्रुटी") || t.includes("failed")) return "error";
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/45 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h3
            className={`px-5 py-3 text-base font-extrabold text-white ${resolvedType === "success"
                ? "bg-green-500"
                : resolvedType === "error"
                  ? "bg-red-500"
                  : "bg-gray-700"
              }`}
          >
            {title}
          </h3>
        ) : null}
        <div className="p-5">
          <div className="text-sm font-medium leading-relaxed text-muted">{children}</div>
          <div className="mt-4 flex justify-end gap-2">
            {actions ?? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-orange-500 bg-white px-4 py-2 text-sm font-bold text-orange-500 transition hover:bg-orange-500 hover:text-white"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
