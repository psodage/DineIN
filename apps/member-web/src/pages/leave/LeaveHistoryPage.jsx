import { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

export default function LeaveHistoryPage() {
  const { user } = useAuth();
  const memberId = user?.id || user?._id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    api
      .get(`/api/leave/self/${memberId}/history?limit=200`)
      .then((res) => setRows(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [memberId]);

  const statusColor = (s) => {
    if (s === "approved") return "bg-orange-100 text-accent";
    if (s === "rejected") return "bg-red-100 text-red-600";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="min-h-dvh bg-white pb-6">
      <PageHeader title="Leave history" backTo="/dashboard?tab=leaves" />
      {loading ? <LoadingOverlay visible /> : null}
      <div className="space-y-3 px-4 py-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-muted">No leave requests yet.</p>
        ) : (
          rows.map((r) => (
            <article key={r._id} className="rounded-2xl border border-slate-100 bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink">
                  {new Date(r.startDate || r.date).toLocaleDateString()} —{" "}
                  {new Date(r.endDate || r.startDate || r.date).toLocaleDateString()}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusColor(r.status)}`}>
                  {r.status || "pending"}
                </span>
              </div>
              {r.reason ? <p className="mt-2 text-sm text-muted">{r.reason}</p> : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
