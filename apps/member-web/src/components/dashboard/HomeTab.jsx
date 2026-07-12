import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Bell, Calendar, Clock,
  IndianRupee, Menu, RefreshCw, UtensilsCrossed, Utensils,
} from "lucide-react";
import SidebarDrawer from "../layout/SidebarDrawer";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { toLocalYMD, formatCurrencyINR } from "../../lib/dateUtils";
import MemberPollCard from "./MemberPollCard";
import {
  formatDurationLabel,
  resolveMealText,
  resolveMenuFromAtMenu,
} from "./menuUtils";

/* ── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ kind }) {
  const styles = {
    active: "bg-emerald-100 text-emerald-700",
    done: "bg-slate-100   text-slate-500",
    upcoming: "bg-orange-100  text-orange-700",
  };
  const labels = { active: "In Progress", done: "Completed", upcoming: "Upcoming" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[kind] ?? styles.upcoming}`}>
      {labels[kind] ?? "Upcoming"}
    </span>
  );
}

/* ── Meal card ──────────────────────────────────────────────────────────── */
function MealCard({ title, accentColor, timeLabel, menuText, countdown, statusKind }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.98]">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <Utensils className="h-5 w-5" style={{ color: accentColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-ink leading-tight">{title}</h3>
          <StatusBadge kind={statusKind} />
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-muted">{timeLabel}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">{menuText}</p>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted">
          <Clock className="h-3 w-3 shrink-0" />
          {countdown}
        </div>
      </div>
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SectionHeader({ title, action }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-extrabold text-ink">{title}</h2>
      {action}
    </div>
  );
}

/* ── Stat tile (for Quick Stats Row) ────────────────────────────────────── */
function StatTile({ icon: Icon, label, value, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm transition active:scale-95"
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="text-sm font-extrabold text-ink leading-none">{value}</p>
      <p className="text-[9px] font-bold text-muted leading-none">{label}</p>
    </button>
  );
}


/* ── HomeTab ────────────────────────────────────────────────────────────── */
export default function HomeTab({ pollRefreshKey }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const memberId = user?.id || user?._id;
  const hasUnread = Number(user?.notificationCount ?? 0) > 0;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [menuList, setMenuList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  // Dashboard data
  const [billData, setBillData] = useState(null);
  const [snackOrders, setSnackOrders] = useState([]);

  const todayKey = toLocalYMD(now);
  const selectedDateKey = toLocalYMD(selectedDate);

  const greeting = useMemo(() => {
    const hrs = now.getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 17) return "Good Afternoon";
    return "Good Evening";
  }, [now]);

  const firstName = useMemo(() => {
    return (user?.name || "Member").trim().split(" ")[0];
  }, [user?.name]);

  const todayFormatted = useMemo(() => {
    return now.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }, [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  /* ── Fetch menu ─────────────────────────────────── */
  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get("/api/menu");
      setMenuList(Array.isArray(res?.data) ? res.data : []);
    } catch { setMenuList([]); }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  /* ── Fetch dashboard summary data ───────────────── */
  const fetchDashboardData = useCallback(async () => {
    if (!memberId) return;
    try {
      const [billRes, snackRes] = await Promise.allSettled([
        api.get(`/api/member-monthly-due/${memberId}/current`),
        api.get(`/api/snack-orders/orders/${memberId}`),
      ]);
      if (billRes.status === "fulfilled") setBillData(billRes.value?.data || null);
      if (snackRes.status === "fulfilled") setSnackOrders(Array.isArray(snackRes.value?.data) ? snackRes.value.data : []);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    }
  }, [memberId]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  /* ── Refresh handler ────────────────────────────── */
  const onRefresh = async () => {
    setRefreshing(true);
    setNow(new Date());
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
    await Promise.all([fetchMenu(), fetchDashboardData()]);
    setRefreshing(false);
  };

  /* ── Derived bill data ──────────────────────────── */
  const bill = useMemo(() => {
    const total = Number(billData?.totalBill || 0);
    const paid = Number(billData?.paidAmount || 0);
    const due = Math.max(0, total - paid);
    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    return { total, paid, due, pct };
  }, [billData]);

  /* ── Derived snack stats ────────────────────────── */
  const snackStats = useMemo(() => {
    const thisMonth = new Date();
    const monthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthOrders = snackOrders.filter((o) => {
      const d = o.date || o.createdAt;
      return d && String(d).startsWith(monthKey);
    });
    return { count: thisMonthOrders.length };
  }, [snackOrders]);

  /* ── Menu/meal data ─────────────────────────────── */
  const activeMenu = useMemo(() => resolveMenuFromAtMenu(menuList, selectedDate), [menuList, selectedDate]);
  const lunchText = resolveMealText(activeMenu?.lunch);
  const dinnerText = resolveMealText(activeMenu?.dinner);
  const isSelectedToday = selectedDateKey === todayKey;

  const lunchWindow = useMemo(() => {
    const d = new Date(selectedDate);
    const s = new Date(d); s.setHours(13, 30, 0, 0);
    const e = new Date(d); e.setHours(14, 30, 0, 0);
    return { start: s, end: e };
  }, [selectedDate]);

  const dinnerWindow = useMemo(() => {
    const d = new Date(selectedDate);
    const s = new Date(d); s.setHours(19, 30, 0, 0);
    const e = new Date(d); e.setHours(20, 30, 0, 0);
    return { start: s, end: e };
  }, [selectedDate]);

  const lunchStatus = useMemo(() => {
    if (!isSelectedToday) return { countdown: "Starts at 1:30 PM", statusKind: "upcoming" };
    if (now >= lunchWindow.start && now < lunchWindow.end) return { countdown: "In progress", statusKind: "active" };
    if (now >= lunchWindow.end) return { countdown: "Completed", statusKind: "done" };
    return { countdown: formatDurationLabel(lunchWindow.start - now), statusKind: "upcoming" };
  }, [isSelectedToday, now, lunchWindow]);

  const dinnerStatus = useMemo(() => {
    if (!isSelectedToday) return { countdown: "Starts at 7:30 PM", statusKind: "upcoming" };
    if (now >= dinnerWindow.start && now < dinnerWindow.end) return { countdown: "In progress", statusKind: "active" };
    if (now >= dinnerWindow.end) return { countdown: "Completed", statusKind: "done" };
    return { countdown: formatDurationLabel(dinnerWindow.start - now), statusKind: "upcoming" };
  }, [isSelectedToday, now, dinnerWindow]);



  return (
    <>
      <div className="pb-16">

        {/* ── Top bar — Hamburger, Logo & Notifications ─────────────────── */}
        <div className="safe-top fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-100 shadow-sm">
          <div className="mx-auto max-w-lg px-4.5 pt-3 pb-2">
            <div className="relative flex items-center justify-between">
              {/* Left Side: Hamburger Menu */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-surface border border-slate-100 transition hover:bg-slate-100 active:scale-95 z-10"
                aria-label="Open menu"
              >
                <Menu className="h-4.5 w-4.5 text-slate-600" />
              </button>

              {/* Center: Logo and Name */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2.5 pointer-events-auto">
                  <img src="/logo2.png" alt="DineIN" className="h-8.5 w-auto drop-shadow-md" />
                  <span className="text-[15px] font-semibold text-slate-400 select-none pb-0.5">x</span>
                  <div className="text-left">
                    <p className="text-sm font-extrabold tracking-wide text-ink leading-none">DineIN</p>
                    <p className="text-[9px] text-accent font-bold leading-none mt-0.5">Eat Smart. Live Easy.</p>
                  </div>
                </div>
              </div>

              {/* Right Side: Notifications */}
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full bg-surface border border-slate-100 transition hover:bg-slate-100 active:scale-95 z-10"
              >
                <Bell className="h-4.5 w-4.5 text-slate-600" />
                {hasUnread && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Drawer Component */}
        <SidebarDrawer isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Spacer to offset the fixed header */}
        <div className="safe-top pt-14" />

        {/* ── Content sections ─────────────────────────────────── */}
        <div className="mt-17 space-y-3 px-3.5">

          {/* ─── 1. Greeting Banner ────────────────────────────── */}
          <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-md shadow-brand/10">
            <p className="text-lg font-extrabold leading-tight">
              {greeting}, {firstName} 👋
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-white/80">{todayFormatted}</p>
          </div>

          {/* ─── 2. Quick Stats Row ────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              icon={IndianRupee}
              label="Due"
              value={formatCurrencyINR(bill.due)}
              color="#EF4444"
              onClick={() => navigate("/dashboard?tab=bill")}
            />
            <StatTile
              icon={UtensilsCrossed}
              label="Snacks"
              value={`${snackStats.count}`}
              color="#F59E0B"
              onClick={() => navigate("/dashboard?tab=snacks")}
            />
            <StatTile
              icon={Calendar}
              label="Leaves"
              value="View"
              color="#8B5CF6"
              onClick={() => navigate("/dashboard?tab=leaves")}
            />
          </div>

          {/* ─── 3. Quick Actions ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard?tab=leaves")}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50">
                <Calendar className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-ink">Apply Leave</p>
                <p className="text-[9px] text-muted">Request time off</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?tab=snacks")}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                <UtensilsCrossed className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-ink">Order Snack</p>
                <p className="text-[9px] text-muted">Browse & order</p>
              </div>
            </button>
          </div>



          {/* ─── 4. Meal Overview ──────────────────────────────── */}
          <div>
            <SectionHeader
              title="Meal Overview"
              action={
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold text-accent transition hover:bg-orange-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              }
            />
            <div className="space-y-2">
              <MealCard
                title="Lunch"
                accentColor="#F59E0B"
                timeLabel="1:30 PM"
                menuText={lunchText}
                countdown={lunchStatus.countdown}
                statusKind={lunchStatus.statusKind}
              />
              <MealCard
                title="Dinner"
                accentColor="#8B5CF6"
                timeLabel="7:30 PM"
                menuText={dinnerText}
                countdown={dinnerStatus.countdown}
                statusKind={dinnerStatus.statusKind}
              />
            </div>
          </div>

          {/* ─── 5. Today's Poll ──────────────────────────────── */}
          <div>
            <SectionHeader
              title="Today's Poll"
              action={
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                  <BarChart3 className="h-3 w-3" />
                  Live
                </span>
              }
            />
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <MemberPollCard key={`poll-${pollRefreshKey}`} date={selectedDate} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
