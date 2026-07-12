import { useEffect, useState } from "react";
import { Activity, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import LoadingOverlay from "../components/ui/LoadingOverlay";

/* Status badge colours */
const STATUS_STYLES = {
  approved: "bg-orange-100 text-accent",
  pending:  "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-600",
};

function StatusPill({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
        STATUS_STYLES[status?.toLowerCase()] ?? "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

export default function ActivityCalendarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [leaveRows, setLeaveRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/api/members/${user.id}`),
      api.get(`/api/leave/student/${user.id}`),
    ])
      .then(([m, l]) => {
        setMember(m?.data);
        setLeaveRows(Array.isArray(l?.data?.requests) ? l.data.requests : []);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <LoadingOverlay visible />;

  /* Derived stats */
  const approved = leaveRows.filter((r) => r.status === "approved").length;
  const pending  = leaveRows.filter((r) => r.status === "pending").length;
  const rejected = leaveRows.filter((r) => r.status === "rejected").length;

  return (
    <div className="min-h-dvh bg-white pb-8">

      {/* ── Hero header ────────────────────────────────────────── */}
      <header className="safe-top rounded-b-[26px] bg-accent px-5 pb-8 pt-4 text-white">
        <button
          type="button"
          onClick={() => navigate("/dashboard?tab=profile")}
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white transition"
        >
          ‹ Back
        </button>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">My Activity</h1>
            <p className="mt-0.5 text-sm text-white/80">Leave history &amp; membership info</p>
          </div>
          <Activity className="h-10 w-10 text-white/20" />
        </div>
      </header>

      <div className="space-y-4 px-4 -mt-4">

        {/* ── Member since card ──────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <CalendarDays className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Member since</p>
              <p className="font-extrabold text-ink">
                {member?.joiningDate
                  ? new Date(member.joiningDate).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Approved", value: approved, cls: "text-accent" },
            { label: "Pending",  value: pending,  cls: "text-amber-600" },
            { label: "Rejected", value: rejected,  cls: "text-red-600" },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-100 bg-surface p-3 text-center"
            >
              <p className="text-xs text-muted">{label}</p>
              <p className={`mt-0.5 text-xl font-extrabold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Recent activity list ───────────────────────────────── */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4">
          <h2 className="mb-3 text-sm font-extrabold text-ink">Recent leave activity</h2>
          {leaveRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Activity className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-muted">No activity yet.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {leaveRows.slice(0, 12).map((r) => (
                <li
                  key={r._id}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-sm"
                >
                  <span className="text-ink font-semibold">
                    {new Date(r.startDate || r.date).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
