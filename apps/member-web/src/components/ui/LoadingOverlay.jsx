export default function LoadingOverlay({ visible, color = "#F97316" }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div
        className="h-11 w-11 animate-spin rounded-full border-[3px] border-slate-200"
        style={{ borderTopColor: color }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
