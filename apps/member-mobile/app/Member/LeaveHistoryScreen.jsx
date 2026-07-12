import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import FullScreenLoading from "../../components/FullScreenLoading";

const COLORS = {
  bgPremium: "#F5F7FA",
  primaryTeal: "#0F8F88",
  textNavy: "#101828",
  mutedText: "#6B7280",
  orangeAccent: "#F59E0B",
  redAccent: "#E11D48",
  greenAccent: "#16A34A",
  border: "#E6EAF0",
  card: "#FFFFFF",
  headerPattern: "rgba(255,255,255,0.14)",
  danger: "#B42318",
};

function formatDateLabel(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusColor(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "approved") return { bg: "#DCFCE7", text: "#166534" };
  if (status === "rejected") return { bg: "#FEE2E2", text: "#991B1B" };
  return { bg: "#FEF3C7", text: "#92400E" };
}

export default function LeaveHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [serverSummary, setServerSummary] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (!memberId) {
      setHistory([]);
      setLoading(false);
      setError("Member session not found. Please log in again.");
      setServerSummary({ total: 0, approved: 0, pending: 0, rejected: 0 });
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError("");
      const res = await api.get(`/api/leave/self/${memberId}/history?limit=200`);
      const data = res?.data || {};
      const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      const summary = data?.summary && typeof data.summary === "object" ? data.summary : null;
      setHistory(rows);
      setServerSummary({
        total: Number(summary?.total || rows.length || 0),
        approved: Number(summary?.approved || 0),
        pending: Number(summary?.pending || 0),
        rejected: Number(summary?.rejected || 0),
      });
    } catch (error) {
      console.error("Leave history fetch error:", error);
      setHistory([]);
      setError("Failed to load leave history.");
      setServerSummary({ total: 0, approved: 0, pending: 0, rejected: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => {
    loadHistory(false);
  }, [loadHistory]);

  const summary = serverSummary;

  const renderItem = ({ item }) => {
    const status = statusColor(item?.status);
    const reason = String(item?.reason || item?.reasonMr || "").trim();
    const periods = Array.isArray(item?.leaveStatPeriods) ? item.leaveStatPeriods : [];
    return (
      <View style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.dateRange} numberOfLines={1}>
              {formatDateLabel(item?.startDate)} - {formatDateLabel(item?.endDate)}
            </Text>
            <Text style={styles.metaText}>Applied On: {formatDateLabel(item?.createdAt)}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>
              {String(item?.status || "Pending")}
            </Text>
          </View>
        </View>

        <View style={styles.rowBottom}>
          <Text style={styles.reasonText} numberOfLines={2}>
            {reason || "No reason provided"}
          </Text>
          {periods.length ? (
            <Text style={styles.periodText} numberOfLines={2}>
              LeaveStat:{" "}
              {periods
                .map(
                  (p) =>
                    `${formatDateLabel(p?.monthStart)} - ${formatDateLabel(p?.monthEnd)}`
                )
                .join(" • ")}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const emptyText = useMemo(() => {
    if (loading) return "";
    return "No leave history found yet. Your applied leaves will appear here.";
  }, [loading]);

  const onRefresh = useCallback(async () => {
    if (loading) return;
    setRefreshing(true);
    await loadHistory(true);
    setRefreshing(false);
  }, [loadHistory, loading]);

  const renderListHeader = () => (
    <>
      <View style={styles.heroHeader}>
        <View style={styles.patternWrap}>
          <Ionicons name="calendar-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="time-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="checkmark-done-outline" size={36} color={COLORS.headerPattern} />
        </View>
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.roundButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#0F4E49" />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Leave History</Text>
        <Text style={styles.heroSubtitle}>Track all your applied leaves</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryPrimary}>{summary.total}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Approved</Text>
            <Text style={styles.summaryTeal}>{summary.approved}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryAmber}>{summary.pending}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Rejected</Text>
            <Text style={styles.summaryRed}>{summary.rejected}</Text>
          </View>
        </View>
        <Text style={styles.summaryBillText}>
          Showing last {Math.min(200, summary.total)} request{summary.total === 1 ? "" : "s"}
        </Text>
      </View>
    </>
  );

  const renderListEmpty = () => (
    <View style={styles.content}>
      {error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={46} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadHistory(false)} activeOpacity={0.85}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={44} color={COLORS.mutedText} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        data={error ? [] : history}
        keyExtractor={(item, index) => String(item?._id || index)}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primaryTeal}
          />
        }
      />

      <FullScreenLoading visible={loading} color={COLORS.primaryTeal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  heroHeader: {
    backgroundColor: COLORS.primaryTeal,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 82,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  patternWrap: {
    position: "absolute",
    right: 12,
    top: 8,
    flexDirection: "row",
    gap: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roundButton: {
    marginTop: 20,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#E6FFFC",
    fontWeight: "500",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    marginTop: -62,
    borderRadius: 20,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryCol: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  summaryDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#EDF0F3",
  },
  summaryLabel: {
    color: "#7C8793",
    fontSize: 10,
    fontWeight: "700",
  },
  summaryPrimary: {
    marginTop: 6,
    fontSize: 22,
    color: COLORS.textNavy,
    fontWeight: "900",
  },
  summaryTeal: {
    marginTop: 6,
    fontSize: 18,
    color: COLORS.greenAccent,
    fontWeight: "800",
  },
  summaryAmber: {
    marginTop: 6,
    fontSize: 18,
    color: COLORS.orangeAccent,
    fontWeight: "800",
  },
  summaryRed: {
    marginTop: 6,
    fontSize: 18,
    color: COLORS.redAccent,
    fontWeight: "800",
  },
  summaryBillText: {
    marginTop: 10,
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    minHeight: 300,
    marginTop: 14,
  },
  rowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  dateRange: {
    color: COLORS.textNavy,
    fontSize: 14,
    fontWeight: "800",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  metaText: {
    marginTop: 6,
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  rowBottom: {
    marginTop: 10,
  },
  reasonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  periodText: {
    marginTop: 8,
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    marginTop: 10,
    color: COLORS.mutedText,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    marginTop: 10,
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: COLORS.textNavy,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
