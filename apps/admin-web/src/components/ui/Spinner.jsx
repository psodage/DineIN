export default function Spinner({ className = "h-8 w-8", label = "Loading" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status">
      <div
        className={`animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 ${className}`}
      />
      {label ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </div>
  );
}
