import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, History } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrencyINR, monthKeyLocal } from "../../lib/dateUtils";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

function formatMonthLabel(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function BillTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;

  const [loading, setLoading] = useState(true);
  const [monthSummary, setMonthSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [currentRes, payRes, histRes] = await Promise.all([
          api.get(`/api/member-monthly-due/${memberId}/current`),
          api.get(`/api/payments/${memberId}`),
          api.get(`/api/member-monthly-due/${memberId}/history?all=true`),
        ]);
        if (!cancelled) {
          setMonthSummary(currentRes?.data || null);
          setPayments(Array.isArray(payRes?.data) ? payRes.data : []);
          setHistory(Array.isArray(histRes?.data) ? histRes.data : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const premium = useMemo(() => {
    const total = Number(monthSummary?.totalBill || 0);
    const paid = Number(monthSummary?.paidAmount || 0);
    const due = Math.max(0, total - paid);
    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    return { total, paid, due, pct };
  }, [monthSummary]);

  const totalDue = useMemo(() => {
    const currentMonthKey = monthSummary?.month ? monthKeyLocal(monthSummary.month) : "";
    let sum = 0;
    let currentMonthCounted = false;
    for (const row of history) {
      const rowMonthKey = monthKeyLocal(row.month);
      if (rowMonthKey === currentMonthKey) {
        sum += premium.due;
        currentMonthCounted = true;
      } else {
        sum += Number(row.due || 0);
      }
    }
    if (!currentMonthCounted) {
      sum += premium.due;
    }
    return sum;
  }, [history, premium.due, monthSummary?.month]);

  if (loading) return <LoadingOverlay visible />;

  return (
    <div className="min-h-dvh bg-white pb-16">
      <header className="safe-top rounded-b-[26px] bg-accent px-5 pb-8 pt-4 text-white">
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => navigate("/bill/payments")}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">My Bill</h1>
        <p className="text-sm text-white/85">
          {monthSummary?.month ? formatMonthLabel(monthSummary.month) : "Current month"}
        </p>
      </header>

      <div className="space-y-4 px-4 -mt-4">
        {/* Stats row — matches LeaveTab's 3-column stats */}
        <div className="rounded-2xl border border-slate-100 bg-surface grid grid-cols-3 gap-2 p-4 text-center text-sm">
          <div>
            <p className="text-muted">Total</p>
            <p className="font-extrabold text-ink">{formatCurrencyINR(premium.total)}</p>
          </div>
          <div>
            <p className="text-muted">Paid</p>
            <p className="font-extrabold text-accent">{formatCurrencyINR(premium.paid)}</p>
          </div>
          <div>
            <p className="text-muted">Total Due</p>
            <p className="font-extrabold text-red-600">{formatCurrencyINR(totalDue)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4">
          <p className="text-sm font-extrabold text-ink mb-3">Payment Progress</p>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${premium.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted text-center font-bold">{premium.pct}% paid</p>
        </div>

        {/* Breakdown grid */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4">
          <p className="text-sm font-extrabold text-ink mb-3">Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Meals", monthSummary?.mealAmount],
              ["Snacks", monthSummary?.snacksAmount],
              ["Expenses", monthSummary?.expenseShare],
              ["Leave adj.", monthSummary?.leaveDeduction],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs font-semibold text-muted">{label}</p>
                <p className="mt-1 text-sm font-extrabold text-ink">{formatCurrencyINR(val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Past months */}
        {history.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-surface p-4">
            <p className="text-sm font-extrabold text-ink mb-3">Past months</p>
            <ul className="space-y-2">
              {history.slice(0, 6).map((row) => (
                <li
                  key={monthKeyLocal(row?.month) || row?._id}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{formatMonthLabel(row?.month)}</span>
                  <span className="font-bold text-ink">{formatCurrencyINR(row?.due ?? row?.totalBill)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Recent payments */}
        {payments.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-surface p-4">
            <p className="text-sm font-extrabold text-ink mb-3">Recent payments</p>
            <ul className="space-y-2">
              {payments.slice(0, 4).map((p) => (
                <li key={p._id} className="flex justify-between rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-semibold">{new Date(p.date || p.createdAt).toLocaleDateString()}</span>
                  <span className="font-bold text-green-700">{formatCurrencyINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
