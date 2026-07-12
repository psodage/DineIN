export function Input({ icon: Icon, className = "", ...props }) {
  return (
    <label className={`flex min-h-[52px] items-center gap-3 rounded-2xl bg-slate-100 px-4 ${className}`}>
      {Icon ? <Icon className="h-5 w-5 shrink-0 text-slate-500" /> : null}
      <input
        className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400"
        {...props}
      />
    </label>
  );
}
