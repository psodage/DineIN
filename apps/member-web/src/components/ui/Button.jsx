const variants = {
  primary: "bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-dark",
  accent: "bg-accent text-white shadow-lg shadow-brand/25 hover:bg-orange-600",
  ghost: "bg-transparent text-brand hover:bg-brand/10",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
  outline: "border border-slate-200 bg-white text-ink hover:bg-slate-50",
};

const sizes = {
  sm: "min-h-9 rounded-xl px-4 text-xs gap-1.5",
  md: "min-h-12 rounded-2xl px-5 text-sm gap-2",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : null}
      {children}
    </button>
  );
}
