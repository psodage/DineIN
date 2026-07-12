import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import api from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading";

const COLORS = {
  bgPremium: "#F5F7FA",
  primaryTeal: "#0F8F88",
  textNavy: "#101828",
  mutedText: "#6B7280",
  orangeAccent: "#F59E0B",
  purpleAccent: "#8B5CF6",
  redAccent: "#E11D48",
  greenAccent: "#16A34A",
  headerPattern: "rgba(255,255,255,0.14)",
};

function formatMonthLabel(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function formatPaymentDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleDateString("en-US", { month: "short" });
    const yr = String(d.getFullYear());
    return `${day} ${mon} ${yr}`;
  } catch {
    return "";
  }
}

function monthKeyLocal(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatPercent(amount, total) {
  const base = Number(total || 0);
  const value = Number(amount || 0);
  if (!base) return "0%";
  return `${((value / base) * 100).toFixed(2)}%`;
}

function toMemberIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value?._id || value?.id || "");
  }
  return String(value);
}

function SectionHeaderBlock({
  iconName,
  iconColor,
  iconBg,
  title,
  subtitle,
  actionLabel,
}) {
  return (
    <View style={styles.sectionBlockHeader}>
      <View style={styles.sectionBlockLeft}>
        <View style={[styles.sectionBlockIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={17} color={iconColor} />
        </View>
        <View>
          <Text style={styles.sectionBlockTitle}>{title}</Text>
          <Text style={styles.sectionBlockSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {actionLabel ? <Text style={styles.sectionActionText}>{actionLabel}</Text> : null}
    </View>
  );
}

const MemberBill = ({ embedded = false }) => {
  const router = useRouter();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;

  const [monthSummary, setMonthSummary] = useState(null);
  const [activeMonthSummary, setActiveMonthSummary] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState([]);
  const [monthlyDueHistory, setMonthlyDueHistory] = useState([]);
  const [lifetimeBreakdown, setLifetimeBreakdown] = useState({
    mealAmount: 0,
    snacksAmount: 0,
    expenseShare: 0,
    leaveDeduction: 0,
    finalTotal: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!memberId) {
        if (!cancelled) setIsInitialLoading(false);
        return;
      }
      try {
        const res = await api.get(`/api/member-monthly-due/${memberId}/current`);
        if (!cancelled) {
          const summary = res?.data || null;
          setActiveMonthSummary(summary);
          setMonthSummary(summary);
          setSelectedMonthKey(monthKeyLocal(summary?.month));
        }
      } catch (e) {
        console.error("Member bill month summary fetch error:", e);
        if (!cancelled) {
          setActiveMonthSummary(null);
          setMonthSummary(null);
          setSelectedMonthKey("");
        }
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLifetimeBreakdown() {
      if (!memberId) {
        if (!cancelled) {
          setLifetimeBreakdown({
            mealAmount: 0,
            snacksAmount: 0,
            expenseShare: 0,
            leaveDeduction: 0,
            finalTotal: 0,
          });
        }
        return;
      }

      const monthKeys = Array.from(
        new Set(
          monthlyDueHistory
            .map((row) => monthKeyLocal(row?.month))
            .filter((key) => Boolean(key))
        )
      );

      if (!monthKeys.length) {
        if (!cancelled) {
          setLifetimeBreakdown({
            mealAmount: 0,
            snacksAmount: 0,
            expenseShare: 0,
            leaveDeduction: 0,
            finalTotal: 0,
          });
        }
        return;
      }

      const monthSummaries = await Promise.all(
        monthKeys.map(async (monthKey) => {
          try {
            const res = await api.get(`/api/member-monthly-due/${memberId}?month=${monthKey}`);
            return res?.data || null;
          } catch (e) {
            console.error("Member bill lifetime month summary fetch error:", e);
            return null;
          }
        })
      );

      const totals = monthSummaries.reduce(
        (acc, row) => {
          if (!row) return acc;
          acc.snacksAmount += Number(row?.snacksAmount || 0);
          acc.expenseShare += Number(row?.expenseShare || 0);
          acc.leaveDeduction += Number(row?.leaveDeduction || 0);
          return acc;
        },
        { mealAmount: 0, snacksAmount: 0, expenseShare: 0, leaveDeduction: 0 }
      );

      const mealDueTotal = monthlyDueHistory.reduce(
        (sum, row) => sum + Number(row?.due || 0),
        0
      );
      totals.mealAmount = mealDueTotal;

      const finalTotal =
        Number(mealDueTotal || 0) + Number(totals.expenseShare || 0);

      if (!cancelled) {
        setLifetimeBreakdown({
          ...totals,
          finalTotal: Math.max(0, finalTotal),
        });
      }
    }

    loadLifetimeBreakdown();

    return () => {
      cancelled = true;
    };
  }, [memberId, monthlyDueHistory]);

  useEffect(() => {
    let cancelled = false;
    async function loadMonthByKey() {
      if (!memberId || !selectedMonthKey) return;
      try {
        setIsMonthLoading(true);
        const res = await api.get(`/api/member-monthly-due/${memberId}?month=${selectedMonthKey}`);
        if (!cancelled) setMonthSummary(res?.data || null);
      } catch (e) {
        console.error("Member bill selected month summary fetch error:", e);
        if (!cancelled) setMonthSummary(null);
      } finally {
        if (!cancelled) setIsMonthLoading(false);
      }
    }
    loadMonthByKey();
    return () => {
      cancelled = true;
    };
  }, [memberId, selectedMonthKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!memberId) return;
      try {
        const res = await api.get(`/api/member-monthly-due/${memberId}/history?all=true`);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) setMonthlyDueHistory(rows);
      } catch (e) {
        // History endpoint may be unavailable for some members; hide section gracefully.
        if (!cancelled) setMonthlyDueHistory([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!memberId) return;
      try {
        const res = await api.get(`/api/payments/${memberId}`);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) setPayments(rows);
      } catch (e) {
        console.error("Member bill payments fetch error:", e);
        if (!cancelled) setPayments([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const premiumSummary = useMemo(() => {
    const totalAmount = Number(monthSummary?.totalBill || 0);
    const paidAmount = Number(monthSummary?.paidAmount || 0);
    const remainingAmount = Number(monthSummary?.remainingAmount ?? monthSummary?.monthlyDue ?? 0);
    const effectiveDue = remainingAmount < 0 ? remainingAmount : Math.max(0, remainingAmount);

    const statusRaw = String(monthSummary?.monthlyStatus || "").trim();
    const status =
      statusRaw ||
      (totalAmount > 0 && remainingAmount <= 0
        ? "Paid"
        : paidAmount > 0
          ? "Partial"
          : "Pending");

    return {
      month: monthSummary?.month ? formatMonthLabel(monthSummary.month) : formatMonthLabel(new Date()),
      totalAmount,
      paidAmount,
      // keep raw sign for status/progress decisions; UI display clamps separately where needed
      dueAmount: effectiveDue,
      status,
    };
  }, [monthSummary]);

  const paidRatio = useMemo(() => {
    const paid = Number(premiumSummary.paidAmount || 0);
    const due = Number(premiumSummary.dueAmount || 0);

    // If due is negative, treat it as fully paid (overpaid).
    if (due < 0) return 1;

    // Scale the bar based on paid vs due (paid / (paid + due)).
    const totalForProgress = Math.max(0, paid) + Math.max(0, due);
    if (totalForProgress <= 0) return 0;
    return Math.max(0, Math.min(1, Math.max(0, paid) / totalForProgress));
  }, [premiumSummary.paidAmount, premiumSummary.dueAmount]);

  const dueRatio = 1 - paidRatio;

  const currentMonthDueAmount = useMemo(() => {
    return Number(activeMonthSummary?.due ?? activeMonthSummary?.monthlyDue ?? 0);
  }, [activeMonthSummary]);

  const totalDueAllMonths = useMemo(() => {
    return monthlyDueHistory.reduce((sum, row) => sum + Number(row?.due || 0), 0);
  }, [monthlyDueHistory]);

  const netDueAllMonths = useMemo(() => {
    return monthlyDueHistory.reduce((sum, row) => {
      const due = Number(row?.due || 0);
      const collected = Number(row?.collected || 0);
      return sum + Math.max(0, due - collected);
    }, 0);
  }, [monthlyDueHistory]);

  const headerStatus = useMemo(() => {
    // Align status with the "Due Amount" value shown in the header.
    if (netDueAllMonths <= 0) return "Paid";
    return Number(premiumSummary.paidAmount || 0) > 0 ? "Partial" : "Pending";
  }, [netDueAllMonths, premiumSummary.paidAmount]);

  const headerPaidRatio = useMemo(() => {
    // Align progress bar with the "Due Amount" shown in the header.
    if (netDueAllMonths <= 0) return 1;
    const paid = Math.max(0, Number(premiumSummary.paidAmount || 0));
    const due = Math.max(0, Number(netDueAllMonths || 0));
    const total = paid + due;
    if (!total) return 0;
    return Math.max(0, Math.min(1, paid / total));
  }, [netDueAllMonths, premiumSummary.paidAmount]);

  const paymentHistoryData = useMemo(() => {
    const targetMonthKey = monthSummary?.month ? monthKeyLocal(monthSummary.month) : "";
    const filtered = targetMonthKey
      ? payments.filter((p) => monthKeyLocal(p?.month) === targetMonthKey)
      : payments;

    return filtered.slice(0, 6).map((p) => {
      const method = String(p?.paymentMethod || "Cash");
      const amount = Number(p?.paidAmount || 0);
      return {
        id: String(p?._id || p?.id || `${p?.date || ""}-${amount}`),
        date: formatPaymentDate(p?.date || p?.createdAt || p?.updatedAt),
        method,
        amount,
        status: "Paid",
      };
    });
  }, [payments, monthSummary?.month]);

  const availableMonthKeys = useMemo(() => {
    const keys = new Set(
      monthlyDueHistory
        .map((row) => monthKeyLocal(row?.month))
        .filter((key) => Boolean(key))
    );
    const activeMonthKey = monthKeyLocal(monthSummary?.month);
    if (activeMonthKey) keys.add(activeMonthKey);
    return Array.from(keys).sort();
  }, [monthlyDueHistory, monthSummary?.month]);

  useEffect(() => {
    if (!availableMonthKeys.length) return;
    if (selectedMonthKey && availableMonthKeys.includes(selectedMonthKey)) return;
    const fallbackMonthKey = availableMonthKeys[availableMonthKeys.length - 1];
    setSelectedMonthKey(fallbackMonthKey);
  }, [availableMonthKeys, selectedMonthKey]);

  const selectedMonthIndex = useMemo(() => {
    return availableMonthKeys.indexOf(selectedMonthKey);
  }, [availableMonthKeys, selectedMonthKey]);

  const hasPreviousMonth = selectedMonthIndex > 0;
  const hasNextMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < availableMonthKeys.length - 1;

  const switchMonth = (direction) => {
    if (!availableMonthKeys.length || selectedMonthIndex < 0 || isMonthLoading) return;
    const nextIndex = selectedMonthIndex + direction;
    if (nextIndex < 0 || nextIndex >= availableMonthKeys.length) return;
    setSelectedMonthKey(availableMonthKeys[nextIndex]);
  };

  const onRefresh = useCallback(async () => {
    if (!memberId) return;
    try {
      setRefreshing(true);
      const [currentRes, historyRes, paymentsRes] = await Promise.all([
        api.get(`/api/member-monthly-due/${memberId}/current`),
        api.get(`/api/member-monthly-due/${memberId}/history?all=true`),
        api.get(`/api/payments/${memberId}`),
      ]);

      const currentSummary = currentRes?.data || null;
      const historyRows = Array.isArray(historyRes?.data) ? historyRes.data : [];
      const paymentRows = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
      const resolvedMonthKey = selectedMonthKey || monthKeyLocal(currentSummary?.month);

      setActiveMonthSummary(currentSummary);
      setMonthlyDueHistory(historyRows);
      setPayments(paymentRows);
      if (resolvedMonthKey) {
        setSelectedMonthKey(resolvedMonthKey);
      }

      if (resolvedMonthKey) {
        try {
          const selectedRes = await api.get(
            `/api/member-monthly-due/${memberId}?month=${resolvedMonthKey}`
          );
          setMonthSummary(selectedRes?.data || currentSummary);
        } catch (e) {
          console.error("Member bill refresh selected month summary fetch error:", e);
          setMonthSummary(currentSummary);
        }
      } else {
        setMonthSummary(currentSummary);
      }
    } catch (e) {
      console.error("Member bill refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [memberId, selectedMonthKey]);

  const previousBillsData = useMemo(() => {
    const targetMonthKey = monthSummary?.month ? monthKeyLocal(monthSummary.month) : "";
    const rows = monthlyDueHistory
      .filter((row) => {
        const key = monthKeyLocal(row?.month);
        return key && key !== targetMonthKey;
      })
      .sort((a, b) => new Date(b?.month).getTime() - new Date(a?.month).getTime())
      .slice(0, 2)
      .map((row) => ({
        id: String(row?._id || row?.id || row?.month),
        month: formatMonthLabel(row?.month),
        amount: Number(row?.totalBill ?? Number(row?.due || 0) + Number(row?.collected || 0)),
        status: String(row?.status || "Pending"),
      }));

    return rows;
  }, [monthlyDueHistory, monthSummary?.month]);

  const chargesData = useMemo(() => {
    const snacksAmount = Number(lifetimeBreakdown?.snacksAmount || 0);
    const mealDueTotal = monthlyDueHistory.reduce(
      (sum, row) => sum + Number(row?.due || 0),
      0
    );
    const mealAmount = mealDueTotal;
    const expenseShare = Number(lifetimeBreakdown?.expenseShare || 0);
    const leaveDeduction = Number(lifetimeBreakdown?.leaveDeduction || 0);
    const totalAmount = Number(lifetimeBreakdown?.finalTotal || 0);

    return [
      {
        key: "meal",
        title: "Meal Charges",
        amount: mealAmount,
        percent: formatPercent(mealAmount, totalAmount),
        icon: "restaurant-outline",
        iconColor: COLORS.primaryTeal,
        iconBg: "#E4F7F5",
      },
      {
        key: "snacks",
        title: "Extra Snacks",
        amount: snacksAmount,
        percent: formatPercent(snacksAmount, totalAmount),
        icon: "cafe-outline",
        iconColor: COLORS.orangeAccent,
        iconBg: "#FFF2E7",
      },
      {
        key: "shared",
        title: "Shared Expenses",
        amount: expenseShare,
        percent: formatPercent(expenseShare, totalAmount),
        icon: "flash-outline",
        iconColor: COLORS.purpleAccent,
        iconBg: "#F1EAFF",
      },
      {
        key: "leave",
        title: "Leave Deduction",
        amount: -leaveDeduction,
        percent: formatPercent(-leaveDeduction, totalAmount),
        icon: "calendar-outline",
        iconColor: COLORS.redAccent,
        iconBg: "#FFEDEE",
      },
    ];
  }, [lifetimeBreakdown, monthlyDueHistory]);

  const content = (
    <ScrollView
      style={styles.billScreen}
      contentContainerStyle={[
        styles.billScrollContent,
        !embedded && styles.billScrollContentStandalone,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primaryTeal}
        />
      }
    >
      <View style={styles.billHeroHeader}>
        <View style={styles.billPatternWrap}>
          <Ionicons name="fast-food-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="cafe-outline" size={36} color={COLORS.headerPattern} />
          <Ionicons name="pizza-outline" size={36} color={COLORS.headerPattern} />
        </View>
        <View style={styles.billHeroTopRow}>
          {embedded ? (
            <View style={styles.billRoundButtonPlaceholder} />
          ) : (
            <TouchableOpacity
              style={styles.billRoundButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#0F4E49" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.historyPillButton}
            activeOpacity={0.85}
            onPress={() => router.push("/Member/MemberPaymentHistory")}
          >
            <Ionicons name="time-outline" size={14} color="#0F4E49" />
            <Text style={styles.historyPillText}>Payment History</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.billHeroTitle}>My Bill</Text>
        <Text style={styles.billHeroSubtitle}>Your monthly billing summary</Text>
      </View>

      <View style={styles.floatingSummaryCard}>
        <View style={styles.monthSwitcherBar}>
          <TouchableOpacity
            style={[styles.monthNavButton, !hasPreviousMonth && styles.monthNavButtonDisabled]}
            activeOpacity={0.8}
            onPress={() => switchMonth(-1)}
            disabled={!hasPreviousMonth || isMonthLoading}
          >
            <Ionicons
              name="chevron-back"
              size={16}
              color={hasPreviousMonth ? COLORS.textNavy : "#B8C2CC"}
            />
          </TouchableOpacity>
          <Text style={styles.summaryMonth}>{premiumSummary.month}</Text>
          <TouchableOpacity
            style={[styles.monthNavButton, !hasNextMonth && styles.monthNavButtonDisabled]}
            activeOpacity={0.8}
            onPress={() => switchMonth(1)}
            disabled={!hasNextMonth || isMonthLoading}
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={hasNextMonth ? COLORS.textNavy : "#B8C2CC"}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCol, styles.summaryColWide]}>
            <Text style={styles.summaryLabel}>Total Bill Amount</Text>
            <Text style={styles.summaryPrimaryAmount}>
              ₹{currentMonthDueAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.summaryColDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Paid Amount</Text>
            <Text style={styles.summaryTealAmount}>
              ₹{premiumSummary.paidAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.summaryColDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Due Amount</Text>
            <Text style={styles.summaryRedAmount}>
              ₹{netDueAllMonths.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.summaryColDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Status</Text>
            <View
              style={[
                styles.partialBadge,
                headerStatus === "Paid" ? styles.paidBadge : null,
              ]}
            >
              <Text
                style={[
                  styles.partialBadgeText,
                  headerStatus === "Paid" ? styles.paidBadgeText : null,
                ]}
              >
                {headerStatus}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.summaryProgressTrack}>
          <View style={[styles.summaryProgressFill, { width: `${headerPaidRatio * 100}%` }]} />
        </View>
        <View style={styles.summaryProgressMetaRow}>
          <Text style={styles.summaryProgressPaid}>{Math.round(headerPaidRatio * 100)}% Paid</Text>
          <Text style={styles.summaryProgressDue}>
            {Math.round((1 - headerPaidRatio) * 100)}% Due
          </Text>
        </View>
      </View>

      <View style={styles.premiumCard}>
        <SectionHeaderBlock
          iconName="grid-outline"
          iconColor={COLORS.primaryTeal}
          iconBg="#E7F7F5"
          title="Charges Breakdown"
          subtitle="Lifetime charges summary"
        />
        <View style={styles.chargesGrid}>
          {chargesData.map((item) => (
            <View key={item.key} style={styles.chargeMiniCard}>
              <View style={[styles.chargeIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={18} color={item.iconColor} />
              </View>
              <Text style={styles.chargeTitle}>{item.title}</Text>
              <Text
                style={[
                  styles.chargeAmount,
                  item.amount < 0 ? styles.chargeAmountNegative : null,
                ]}
              >
                {item.amount < 0 ? "-₹" : "₹"}
                {Math.abs(item.amount).toLocaleString("en-IN")}
              </Text>
              <Text
                style={[
                  styles.chargePercent,
                  item.amount < 0 ? styles.chargeAmountNegative : null,
                ]}
              >
                {item.percent}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.finalTotalStrip}>
          <Text style={styles.finalTotalLabel}>Final Total</Text>
          <Text style={styles.finalTotalValue}>
            ₹{Number(lifetimeBreakdown.finalTotal || 0).toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

       

      {previousBillsData.length > 0 ? (
        <View style={styles.premiumCard}>
          <SectionHeaderBlock
            iconName="document-text-outline"
            iconColor="#5F7285"
            iconBg="#EEF2F7"
            title="Previous Bills"
            subtitle="Your last 2 months billing"
            actionLabel="View All"
          />
          {previousBillsData.map((item, index) => (
            <React.Fragment key={item.id}>
              <View style={styles.previousRow}>
                <Text style={styles.previousMonth}>{item.month}</Text>
                <View style={styles.previousRightBlock}>
                  <Text style={styles.previousAmount}>₹{item.amount.toLocaleString("en-IN")}</Text>
                  <View style={styles.paidBadgeRow}>
                    <Text style={styles.paidBadgeText}>{item.status}</Text>
                    <View style={styles.paidDot} />
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#93A1AF" />
                </View>
              </View>
              {index < previousBillsData.length - 1 ? <View style={styles.itemDivider} /> : null}
            </React.Fragment>
          ))}
        </View>
      ) : null}

    
    </ScrollView>
  );

  if (embedded) {
    return (
      <>
        {content}
        <FullScreenLoading visible={isInitialLoading || isMonthLoading} color="#111827" />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {content}
      <FullScreenLoading visible={isInitialLoading || isMonthLoading} color="#111827" />
    </SafeAreaView>
  );
};

export default MemberBill;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  billScreen: {
    flex: 1,
    backgroundColor: COLORS.bgPremium,
  },
  billScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  billScrollContentStandalone: {
    paddingBottom: 120,
  },
  billHeroHeader: {
    backgroundColor: COLORS.primaryTeal,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 78,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  billPatternWrap: {
    position: "absolute",
    right: 12,
    top: 8,
    flexDirection: "row",
    gap: 10,
  },
  billHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billRoundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  billRoundButtonPlaceholder: {
    width: 38,
    height: 38,
  },
  historyPillButton: {
    marginTop:20,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyPillText: {
    color: COLORS.primaryTeal,
    fontWeight: "700",
    fontSize: 12,
  },
  billHeroTitle: {
    marginTop: 18,
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  billHeroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#E6FFFC",
    fontWeight: "500",
  },
  floatingSummaryCard: {
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
    alignItems: "stretch",
  },
  summaryCol: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  summaryColWide: {
    flex: 1.4,
    paddingLeft: 0,
  },
  summaryColDivider: {
    width: 1,
    backgroundColor: "#EDF0F3",
  },
  summaryMonth: {
    color: COLORS.textNavy,
    fontSize: 17,
    fontWeight: "800",
  },
  monthSwitcherBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  monthSwitcherRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  monthNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  monthNavButtonDisabled: {
    borderColor: "#EEF2F6",
    backgroundColor: "#F7F9FB",
  },
  summaryLabel: {
    color: "#7C8793",
    fontSize: 10,
    fontWeight: "700",
  },
  summaryPrimaryAmount: {
    color: COLORS.primaryTeal,
    fontSize: 29,
    fontWeight: "900",
    marginTop: 3,
  },
  summaryTealAmount: {
    color: COLORS.primaryTeal,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 6,
  },
  summaryRedAmount: {
    color: COLORS.redAccent,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 6,
  },
  partialBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFE9EC",
  },
  paidBadge: {
    backgroundColor: "#E6F8EF",
  },
  partialBadgeText: {
    color: COLORS.redAccent,
    fontSize: 11,
    fontWeight: "800",
  },
  paidBadgeText: {
    color: COLORS.greenAccent,
  },
  summaryProgressTrack: {
    marginTop: 12,
    height: 7,
    backgroundColor: "#E8EDF1",
    borderRadius: 999,
    overflow: "hidden",
  },
  summaryProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primaryTeal,
  },
  summaryProgressMetaRow: {
    marginTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryProgressPaid: {
    fontSize: 11,
    color: COLORS.primaryTeal,
    fontWeight: "700",
  },
  summaryProgressDue: {
    fontSize: 11,
    color: "#7C8793",
    fontWeight: "700",
  },
  premiumCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 14,
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionBlockLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionBlockIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionBlockTitle: {
    fontSize: 18,
    color: COLORS.textNavy,
    fontWeight: "800",
  },
  sectionBlockSubtitle: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 3,
    fontWeight: "500",
  },
  sectionActionText: {
    color: COLORS.primaryTeal,
    fontWeight: "700",
    fontSize: 12,
  },
  chargesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  chargeMiniCard: {
    width: "48.6%",
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFF2F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  chargeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  chargeTitle: {
    color: "#566273",
    fontSize: 11,
    fontWeight: "600",
  },
  chargeAmount: {
    color: COLORS.textNavy,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 3,
  },
  chargeAmountNegative: {
    color: COLORS.redAccent,
  },
  chargePercent: {
    marginTop: 2,
    fontSize: 12,
    color: "#5F7285",
    fontWeight: "700",
  },
  finalTotalStrip: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryTeal,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  finalTotalLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  finalTotalValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#EBEFF3",
    marginVertical: 12,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentDate: {
    fontSize: 14,
    color: COLORS.textNavy,
    fontWeight: "800",
  },
  paymentMethod: {
    marginTop: 5,
    color: "#687687",
    fontSize: 11,
    fontWeight: "500",
  },
  paymentRightBlock: {
    alignItems: "flex-end",
  },
  paymentAmount: {
    color: COLORS.primaryTeal,
    fontSize: 18,
    fontWeight: "800",
  },
  paidBadgeRow: {
    marginTop: 6,
    backgroundColor: "#E6F8EF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  paidBadgeText: {
    color: COLORS.greenAccent,
    fontSize: 11,
    fontWeight: "700",
  },
  paidDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.greenAccent,
    marginLeft: 6,
  },
  previousRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previousMonth: {
    color: COLORS.textNavy,
    fontSize: 15,
    fontWeight: "700",
  },
  previousRightBlock: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  previousAmount: {
    color: COLORS.textNavy,
    fontSize: 16,
    fontWeight: "700",
  },
  downloadButton: {
    backgroundColor: COLORS.primaryTeal,
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  downloadButtonText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
