import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import DashboardHeader from "../../components/DashboardHeader";
import DashboardSidebar from "../../components/DashboardSidebar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Bottom tab items
// ---------------------------------------------------------------------------
const BOTTOM_TABS = [
  { id: "home",     icon: "home-outline",      iconActive: "home",         label: "Home" },
  { id: "students", icon: "people-outline",    iconActive: "people",       label: "Members" },
  { id: "payments", icon: "card-outline",      iconActive: "card",         label: "Payments" },
  { id: "snacks",   icon: "fast-food-outline", iconActive: "fast-food",    label: "Snacks" },
];

// Quick Actions
const QUICK_ACTIONS = [
  { id: "students", icon: "people",         label: "Members",  labelMr: "सदस्य" },
  { id: "snacks",   icon: "fast-food",      label: "Add Meal", labelMr: "जेवण" },
  { id: "payments", icon: "card",           label: "Payments", labelMr: "पेमेंट" },
  { id: "reports",  icon: "document-text",  label: "Reports",  labelMr: "रिपोर्ट" },
  { id: "expenses", icon: "wallet",         label: "Expenses", labelMr: "खर्च" },
  { id: "backups",  icon: "settings",       label: "Settings", labelMr: "सेटिंग्ज" },
];

// ---------------------------------------------------------------------------
// Mini bar chart component (pure RN — no library)
// ---------------------------------------------------------------------------
const MiniBarChart = ({ data = [], color = "#6366F1", label }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const BAR_H = 64;
  return (
    <View style={chartStyles.wrap}>
      <Text style={chartStyles.chartLabel}>{label}</Text>
      <View style={chartStyles.barsRow}>
        {data.map((d, i) => {
          const heightPct = Math.max((d.value / max) * BAR_H, 4);
          return (
            <View key={i} style={chartStyles.barCol}>
              <View style={[chartStyles.barBg, { height: BAR_H }]}>
                <View
                  style={[
                    chartStyles.barFill,
                    { height: heightPct, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={chartStyles.barXLabel}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Mini sparkline-style line chart
// ---------------------------------------------------------------------------
const SparkLine = ({ data = [], color = "#6366F1" }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = (SCREEN_WIDTH - 32 - 32) / 3 - 24;
  const H = 40;
  const step = W / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * step,
    y: H - (v / max) * H,
  }));
  return (
    <View style={{ height: H + 4, width: W }}>
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: len,
              height: 2,
              backgroundColor: color,
              opacity: 0.7,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "0 50%",
            }}
          />
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Activity item
// ---------------------------------------------------------------------------
const ActivityItem = ({ icon, title, subtitle, time, isLast }) => (
  <View style={actStyles.row}>
    <View style={actStyles.lineCol}>
      <View style={actStyles.iconWrap}>
        <Ionicons name={icon} size={14} color="#6366F1" />
      </View>
      {!isLast && <View style={actStyles.line} />}
    </View>
    <View style={actStyles.content}>
      <Text style={actStyles.title}>{title}</Text>
      <Text style={actStyles.subtitle}>{subtitle}</Text>
    </View>
    <Text style={actStyles.time}>{time}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
const KpiCard = ({ icon, label, value, sub, trend, trendUp, anim }) => (
  <Animated.View
    style={[
      kpiStyles.card,
      {
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      },
    ]}
  >
    <View style={kpiStyles.topRow}>
      <View style={kpiStyles.iconBox}>
        <Ionicons name={icon} size={16} color="#6366F1" />
      </View>
      {trend !== undefined && (
        <View style={[kpiStyles.trendBadge, trendUp ? kpiStyles.trendUp : kpiStyles.trendDown]}>
          <Ionicons
            name={trendUp ? "trending-up" : "trending-down"}
            size={10}
            color={trendUp ? "#22C55E" : "#EF4444"}
          />
          <Text style={[kpiStyles.trendText, trendUp ? kpiStyles.trendTextUp : kpiStyles.trendTextDown]}>
            {trend}
          </Text>
        </View>
      )}
    </View>
    <Text style={kpiStyles.value} numberOfLines={1}>{value}</Text>
    <Text style={kpiStyles.label}>{label}</Text>
    {sub && <Text style={kpiStyles.sub}>{sub}</Text>}
  </Animated.View>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const AdminDashboard = () => {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { t, language } = useLanguage();

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  const [stats, setStats] = useState({
    members: null,
    snacks: null,
    expenses: null,
    payments: null,
    pendingLeave: null,
    approvedMembers: null,
    pendingMembers: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // chart data (last 6 months labels)
  const [chartPayments, setChartPayments] = useState([]);
  const [chartExpenses, setChartExpenses] = useState([]);
  const [memberGrowth, setMemberGrowth] = useState([]);

  // KPI card animations (4 cards)
  const kpiAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchAllStats = useCallback(async () => {
    if (!isAuthenticated || loading) return;
    try {
      const [membersRes, snacksRes, expensesRes, paymentsRes, leaveRes] =
        await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/members`),
          axios.get(`${API_BASE_URL}/api/snacks`),
          axios.get(`${API_BASE_URL}/api/expenses`),
          axios.get(`${API_BASE_URL}/api/payments`),
          axios.get(`${API_BASE_URL}/api/leave/all`),
        ]);

      const now = new Date();

      // Members
      const members = Array.isArray(membersRes.value?.data) ? membersRes.value.data : [];
      const approvedMembers = members.filter(
        (m) => String(m?.status || "").toLowerCase() === "approved"
      ).length;
      const pendingMembers = members.filter(
        (m) => String(m?.status || "").toLowerCase() === "pending"
      ).length;

      // Member growth over last 6 months
      const growthData = buildLast6MonthsData(members, "createdAt");
      setMemberGrowth(growthData.map((d) => d.value));

      // Snacks this month
      const snacks = Array.isArray(snacksRes.value?.data) ? snacksRes.value.data : [];
      const thisMonthSnacks = snacks.filter((s) => {
        const d = new Date(s?.createdAt || s?.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;

      // Expenses
      const expenses = Array.isArray(expensesRes.value?.data) ? expensesRes.value.data : [];
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
      const expenseChart = buildLast6MonthsData(expenses, "date", "amount");
      setChartExpenses(expenseChart);

      // Payments
      const payments = Array.isArray(paymentsRes.value?.data) ? paymentsRes.value.data : [];
      const thisMonthPayments = payments
        .filter((p) => {
          const d = new Date(p?.createdAt || p?.date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((sum, p) => sum + Number(p?.paidAmount || p?.amount || 0), 0);
      const paymentChart = buildLast6MonthsData(payments, "createdAt", "paidAmount");
      setChartPayments(paymentChart);

      // Leaves
      const leaves = Array.isArray(leaveRes.value?.data) ? leaveRes.value.data : [];
      const pendingLeave = leaves.filter(
        (l) => String(l?.status || "").toLowerCase() === "pending"
      ).length;

      setStats({
        members: members.length,
        approvedMembers,
        pendingMembers,
        snacks: thisMonthSnacks,
        expenses: totalExpenses,
        payments: thisMonthPayments,
        pendingLeave,
      });
    } catch (_) {
      // silently fail
    } finally {
      setStatsLoading(false);
    }
  }, [isAuthenticated, loading]);

  // Build chart data for the last 6 months
  function buildLast6MonthsData(arr, dateKey, sumKey = null) {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleString("en-IN", { month: "short" });
      const items = arr.filter((item) => {
        const date = new Date(item?.[dateKey]);
        return date.getFullYear() === year && date.getMonth() === month;
      });
      const value = sumKey
        ? items.reduce((s, it) => s + Number(it?.[sumKey] || 0), 0)
        : items.length;
      return { label, value };
    });
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) router.replace("/Admin/AdminLoginScreen");
  }, [loading, isAuthenticated, router]);

  useFocusEffect(
    useCallback(() => {
      fetchAllStats();
      const id = setInterval(fetchAllStats, 60000);
      return () => clearInterval(id);
    }, [fetchAllStats])
  );

  // Staggered KPI entrance animation
  useEffect(() => {
    if (!statsLoading) {
      kpiAnims.forEach((anim, i) => {
        Animated.spring(anim, {
          toValue: 1,
          delay: i * 60,
          damping: 16,
          stiffness: 140,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [statsLoading, kpiAnims]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllStats();
    setRefreshing(false);
  }, [fetchAllStats]);

  const navigate = (id) => {
    switch (id) {
      case "students": return router.push("/Admin/ManageMembers");
      case "expenses": return router.push("/Admin/MessExpenses");
      case "snacks":   return router.push("/Admin/ExtraSnacks");
      case "payments": return router.push("/Admin/Payments");
      case "reports":  return router.push("/Admin/Reports");
      case "backups":  return router.push("/Admin/BackupManagement");
    }
  };

  const handleLogout = () =>
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ],
      { cancelable: true }
    );

  const handleTabPress = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== "home") navigate(tabId);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const fmt = (val, prefix = "") => {
    if (statsLoading || val === null || val === undefined) return "—";
    return prefix === "₹"
      ? `₹${Number(val).toLocaleString("en-IN")}`
      : String(val);
  };

  const hour = currentDateTime.getHours();
  const greeting =
    hour < 12
      ? language === "mr" ? "शुभ सकाळ" : "Good morning"
      : hour < 17
      ? language === "mr" ? "शुभ दुपार" : "Good afternoon"
      : language === "mr" ? "शुभ संध्याकाळ" : "Good evening";

  const adminName = user?.name || user?.username || "";
  const adminEmail = user?.email || "";

  const dateStr = currentDateTime.toLocaleDateString(
    language === "mr" ? "mr-IN" : "en-IN",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  // Mock recent activity items
  const ACTIVITY = [
    { icon: "person-add-outline",    title: "New member registered",    subtitle: "Pending approval", time: "2m ago" },
    { icon: "card-outline",          title: "Payment received",         subtitle: "₹1,200 · Ravi Kumar", time: "18m ago" },
    { icon: "time-outline",          title: "Leave request submitted",   subtitle: "3-day leave", time: "1h ago" },
    { icon: "fast-food-outline",     title: "Snack order placed",        subtitle: "4 items", time: "2h ago" },
  ];

  // ---------------------------------------------------------------------------
  // Guard
  // ---------------------------------------------------------------------------
  if (loading || !isAuthenticated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.root}>
      {/* ── Header ────────────────────────────────────────────── */}
      <DashboardHeader
        onMenuPress={() => setIsSidebarOpen(true)}
        adminName={adminName}
        adminEmail={adminEmail}
        notificationCount={stats.pendingLeave || 0}
      />

      {/* ── Main content ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={["#6366F1"]}
          />
        }
      >
        {/* ── Greeting ────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>
              {greeting}, {adminName || "Admin"} 👋
            </Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ── KPI Cards ───────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KpiCard
            anim={kpiAnims[0]}
            icon="people"
            label={language === "mr" ? "एकूण सदस्य" : "Total Members"}
            value={fmt(stats.members)}
            sub={`${fmt(stats.approvedMembers)} active`}
          />
          <KpiCard
            anim={kpiAnims[1]}
            icon="time"
            label={language === "mr" ? "प्रतीक्षा रजा" : "Pending Leaves"}
            value={fmt(stats.pendingLeave)}
            trend={stats.pendingLeave > 0 ? `${stats.pendingLeave} new` : undefined}
            trendUp={false}
          />
          <KpiCard
            anim={kpiAnims[2]}
            icon="fast-food"
            label={language === "mr" ? "प्रतीक्षा जेवण" : "Pending Meals"}
            value={fmt(stats.snacks)}
            sub="This month"
          />
          <KpiCard
            anim={kpiAnims[3]}
            icon="wallet"
            label={language === "mr" ? "एकूण महसूल" : "Total Revenue"}
            value={fmt(stats.payments, "₹")}
            sub="This month"
            trend="+12%"
            trendUp={true}
          />
        </View>

        {/* ── Quick Actions ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === "mr" ? "द्रुत क्रिया" : "Quick Actions"}
          </Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionBtn}
                onPress={() => navigate(action.id)}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name={action.icon} size={20} color="#6366F1" />
                </View>
                <Text style={styles.actionLabel}>
                  {language === "mr" ? action.labelMr : action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Recent Activity ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {language === "mr" ? "अलीकडील क्रिया" : "Recent Activity"}
            </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.sectionLink}>
                {language === "mr" ? "सर्व पहा" : "View all"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityCard}>
            {ACTIVITY.map((item, i) => (
              <ActivityItem
                key={i}
                {...item}
                isLast={i === ACTIVITY.length - 1}
              />
            ))}
          </View>
        </View>

        {/* ── Analytics ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === "mr" ? "विश्लेषण" : "Analytics"}
          </Text>
          <View style={styles.chartsRow}>
            {chartPayments.length > 0 && (
              <View style={styles.chartCard}>
                <MiniBarChart
                  data={chartPayments}
                  color="#6366F1"
                  label={language === "mr" ? "पेमेंट" : "Payments"}
                />
              </View>
            )}
            {chartExpenses.length > 0 && (
              <View style={styles.chartCard}>
                <MiniBarChart
                  data={chartExpenses}
                  color="#F59E0B"
                  label={language === "mr" ? "खर्च" : "Expenses"}
                />
              </View>
            )}
            {memberGrowth.length > 0 && (
              <View style={[styles.chartCard, styles.chartCardFull]}>
                <View style={styles.growthHeader}>
                  <Text style={chartStyles.chartLabel}>
                    {language === "mr" ? "सदस्य वाढ" : "Member Growth"}
                  </Text>
                  <SparkLine data={memberGrowth} color="#6366F1" />
                </View>
                <Text style={styles.growthValue}>{fmt(stats.members)} total</Text>
              </View>
            )}

            {/* Fallback placeholders if data is empty or loading */}
            {statsLoading && (
              <View style={[styles.chartCard, styles.chartCardFull, styles.chartLoading]}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.chartLoadingText}>Loading analytics…</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 88 }} />
      </ScrollView>

      {/* ── Bottom Tab Bar ────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {BOTTOM_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              {isActive && <View style={styles.tabIndicator} />}
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? "#6366F1" : "#94A3B8"}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <DashboardSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={navigate}
        onLogout={handleLogout}
        adminName={adminName}
        adminEmail={adminEmail}
        adminCreatedAt={user?.createdAt}
        totalMembers={stats.members}
        pendingLeaves={stats.pendingLeave}
        activeScreen={activeTab !== "home" ? activeTab : null}
      />
    </View>
  );
};

export default AdminDashboard;

// ---------------------------------------------------------------------------
// KPI card styles
// ---------------------------------------------------------------------------
const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    minWidth: (SCREEN_WIDTH - 32 - 8) / 2 - 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  trendUp: { backgroundColor: "#F0FDF4" },
  trendDown: { backgroundColor: "#FFF5F5" },
  trendText: { fontSize: 9, fontWeight: "600" },
  trendTextUp: { color: "#22C55E" },
  trendTextDown: { color: "#EF4444" },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 2,
  },
  sub: {
    fontSize: 10,
    color: "#94A3B8",
  },
});

// ---------------------------------------------------------------------------
// Activity styles
// ---------------------------------------------------------------------------
const actStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  lineCol: {
    alignItems: "center",
    width: 28,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
    minHeight: 12,
  },
  content: {
    flex: 1,
    paddingBottom: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  time: {
    fontSize: 11,
    color: "#94A3B8",
    paddingTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Chart styles
// ---------------------------------------------------------------------------
const chartStyles = StyleSheet.create({
  wrap: { gap: 8 },
  chartLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 4,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barBg: {
    width: "100%",
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 3,
    opacity: 0.85,
  },
  barXLabel: {
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
  },
});

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 14,
  },

  // ── Scroll ──────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 0,
  },

  // ── Greeting ────────────────────────────────────────────────
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "400",
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── KPI cards ───────────────────────────────────────────────
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },

  // ── Section ─────────────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 12,
    color: "#6366F1",
    fontWeight: "600",
  },

  // ── Quick Actions ───────────────────────────────────────────
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    width: (SCREEN_WIDTH - 32 - 40) / 6,
    minWidth: 52,
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#475569",
    textAlign: "center",
  },

  // ── Activity ────────────────────────────────────────────────
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },

  // ── Analytics ───────────────────────────────────────────────
  chartsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chartCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 32 - 8) / 2 - 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  chartCardFull: {
    width: "100%",
    flex: 0,
  },
  chartLoading: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  chartLoadingText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  growthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  growthValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  // ── Bottom Tab Bar ───────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 3,
    position: "relative",
  },
  tabIndicator: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#6366F1",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
  },
  tabLabelActive: {
    color: "#6366F1",
    fontWeight: "600",
  },
});
