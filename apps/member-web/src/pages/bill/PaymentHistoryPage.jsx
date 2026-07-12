import { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrencyINR } from "../../lib/dateUtils";
import PageHeader from "../../components/layout/PageHeader";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const memberId = user?.id || user?._id;
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/api/payments/${memberId}`),
      api.get(`/api/member-monthly-due/${memberId}/history?all=true`),
    ])
      .then(([p, h]) => {
        setPayments(Array.isArray(p?.data) ? p.data : []);
        setHistory(Array.isArray(h?.data) ? h.data : []);
      })
      .finally(() => setLoading(false));
  }, [memberId]);

  return (
    <div className="min-h-dvh bg-white pb-6">
      <PageHeader title="Payment history" backTo="/dashboard?tab=bill" />
      {loading ? <LoadingOverlay visible /> : null}
      <div className="space-y-4 px-4 py-4">
        {payments.length === 0 ? (
          <p className="py-8 text-center text-muted">No payments recorded yet.</p>
        ) : (
          payments.map((p) => (
            <article key={p._id} className="rounded-2xl border border-slate-100 bg-surface flex justify-between p-4">
              <div>
                <p className="font-bold text-ink">{formatCurrencyINR(p.amount)}</p>
                <p className="text-xs text-muted">{p.mode || p.method || "Payment"}</p>
              </div>
              <p className="text-sm text-muted">
                {new Date(p.date || p.createdAt).toLocaleDateString()}
              </p>
            </article>
          ))
        )}
        {history.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-surface p-4">
            <h2 className="mb-2 font-extrabold text-ink">Monthly dues</h2>
            {history.map((row) => (
              <div key={row._id} className="flex justify-between border-t border-slate-100 py-2 text-sm first:border-0">
                <span className="text-muted">{new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                <span className="font-bold text-ink">{formatCurrencyINR(row.due ?? row.totalBill)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
