import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/AuthContext";
import api from "../../lib/api";
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

function formatDate(dateLike, options = {}) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-IN", options);
  } catch {
    return "";
  }
}

function formatMonthLabel(dateLike) {
  return formatDate(dateLike, { month: "long", year: "numeric" });
}

function formatPaymentDate(dateLike) {
  return formatDate(dateLike, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MemberPaymentHistory = () => {
  const router = useRouter();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;

  const [payments, setPayments] = useState([]);
  const [monthlyDueHistory, setMonthlyDueHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(async () => {
    if (!memberId) {
      setPayments([]);
      setLoading(false);
      setError("Member session not found. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [paymentsRes, historyRes] = await Promise.all([
        api.get(`/api/payments/${memberId}`),
        api.get(`/api/member-monthly-due/${memberId}/history?all=true`),
      ]);
      const paymentRows = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
      const historyRows = Array.isArray(historyRes?.data) ? historyRes.data : [];
      setPayments(paymentRows);
      setMonthlyDueHistory(historyRows);
    } catch (e) {
      console.error("Member payment history fetch error:", e);
      setPayments([]);
      setMonthlyDueHistory([]);
      setError("Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const onRefresh = useCallback(async () => {
    if (loading) return;
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  }, [fetchPayments, loading]);

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, row) => sum + Number(row?.paidAmount || 0), 0);
    const totalBill = payments.reduce((sum, row) => sum + Number(row?.totalBill || 0), 0);
    const totalDue = monthlyDueHistory.reduce((sum, row) => sum + Number(row?.due || 0), 0);
    const paymentCount = payments.length;

    return { totalPaid, totalBill, totalDue, paymentCount };
  }, [payments, monthlyDueHistory]);

  const recentPayments = useMemo(() => payments.slice(0, 100), [payments]);

  const renderItem = ({ item }) => {
    const amount = Number(item?.paidAmount || 0);
    const method = String(item?.paymentMethod || "Cash");
    const month = formatMonthLabel(item?.month);
    const paidOn = formatPaymentDate(item?.date || item?.createdAt || item?.updatedAt);

    return (
      <View style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View>
            <Text style={styles.amountText}>₹{amount.toLocaleString("en-IN")}</Text>
            <Text style={styles.monthText}>{month || "-"}</Text>
          </View>
          <View style={styles.methodBadge}>
            <Text style={styles.methodText}>{method}</Text>
          </View>
        </View>

        <View style={styles.rowBottom}>
          <Text style={styles.metaText}>Paid On: {paidOn || "-"}</Text>
          <Text style={styles.metaText}>Billing Month: {month || "-"}</Text>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <>
      <View style={styles.heroHeader}>
        <View style={styles.patternWrap}>
          <Ionicons name="card-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="wallet-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="cash-outline" size={36} color={COLORS.headerPattern} />
        </View>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            style={styles.roundButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#0F4E49" />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Payment History</Text>
        <Text style={styles.heroSubtitle}>Track all your monthly payments</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Payments</Text>
            <Text style={styles.summaryPrimary}>{summary.paymentCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryTeal}>₹{summary.totalPaid.toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={styles.summaryRed}>₹{summary.totalDue.toLocaleString("en-IN")}</Text>
          </View>
        </View>
        <Text style={styles.summaryBillText}>Total Billed: ₹{summary.totalBill.toLocaleString("en-IN")}</Text>
      </View>
    </>
  );

  const renderListEmpty = () => (
    <View style={styles.content}>
      {error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={46} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPayments} activeOpacity={0.85}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={44} color={COLORS.mutedText} />
          <Text style={styles.emptyText}>No payments found yet.</Text>
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
        data={error ? [] : recentPayments}
        keyExtractor={(item, index) =>
          String(item?._id || item?.id || `${item?.date || "payment"}-${index}`)
        }
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
};

export default MemberPaymentHistory;

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
    marginTop:20,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshPillText: {
    color: "#0F4E49",
    fontWeight: "700",
    fontSize: 11,
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
    color: COLORS.primaryTeal,
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
  amountText: {
    color: COLORS.primaryTeal,
    fontWeight: "900",
    fontSize: 24,
  },
  monthText: {
    marginTop: 2,
    color: COLORS.textNavy,
    fontSize: 13,
    fontWeight: "700",
  },
  methodBadge: {
    backgroundColor: "#E8F8F7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  methodText: {
    color: COLORS.primaryTeal,
    fontSize: 12,
    fontWeight: "700",
  },
  rowBottom: {
    marginTop: 10,
    gap: 4,
  },
  metaText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: "600",
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
