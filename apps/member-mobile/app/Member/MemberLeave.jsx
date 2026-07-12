import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import api from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading";

const PRIMARY = "#0F8F88";
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_MUTE = "#64748B";
const GREEN_BG = "#DDF5E8";
const GREEN_TEXT = "#188A5A";
const RED_BG = "#FCE8EA";
const RED_TEXT = "#BE3845";
const GREY_BG = "#E5E7EB";
const GREY_TEXT = "#6B7280";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthKeyLocal(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toLocalYmd(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdLocal(ymd) {
  const match = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIndex, day);
  if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) {
    return null;
  }
  return d;
}

function extractDayFromKey(dayKey) {
  if (!dayKey) return null;
  const localYmd = toLocalYmd(dayKey);
  if (!localYmd) return null;
  const match = localYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Number(match[3]) : null;
}

function formatDateLabel(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const total = daysInMonth(year, monthIndex);
  const mondayStart = (first.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const day = i - mondayStart + 1;
    cells.push(day > 0 && day <= total ? day : null);
  }
  return cells;
}

function toMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function hasDateInMonth(dateLike, targetMonthKey) {
  if (!dateLike || !targetMonthKey) return false;
  return monthKeyLocal(dateLike) === targetMonthKey;
}

function toTitleCaseStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function MemberLeave({ embedded = false }) {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState("leaves");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberDetails, setMemberDetails] = useState(null);
  const [monthLeaveSummary, setMonthLeaveSummary] = useState(null);
  const [billSummary, setBillSummary] = useState(null);
  const [leaveDates, setLeaveDates] = useState(new Set());
  const [leaveRequestStats, setLeaveRequestStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    latestStatus: "",
  });
  const [isConfirmApplyModalOpen, setIsConfirmApplyModalOpen] = useState(false);
  const [isLeaveSuccessModalOpen, setIsLeaveSuccessModalOpen] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const tabScaleRef = useRef({
    home: new Animated.Value(1),
    snacks: new Animated.Value(1),
    leaves: new Animated.Value(1),
    bill: new Animated.Value(1),
    profile: new Animated.Value(1),
  });

  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const selectedDay =
    selectedDate.getFullYear() === year && selectedDate.getMonth() === monthIndex
      ? selectedDate.getDate()
      : null;
  const monthTitle = `${MONTHS[monthIndex]} ${year}`;
  const calendarData = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);
  const memberId = user?.id || user?._id;
  const monthKey = useMemo(() => toMonthKey(year, monthIndex), [year, monthIndex]);

  const loadMonthData = useCallback(
    async (isRefresh = false) => {
      if (!memberId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [memberRes, billRes, leaveRes] = await Promise.all([
          api.get(`/api/members/${memberId}`),
          api.get(`/api/member-monthly-due/${memberId}?month=${monthKey}`),
          api.get(`/api/leave/self/${memberId}/month?month=${monthKey}`),
        ]);

        setMemberDetails(memberRes?.data || null);
        setBillSummary(billRes?.data || null);
        setMonthLeaveSummary(leaveRes?.data || null);

        const leaveKeysFromRequests = Array.isArray(leaveRes?.data?.approvedLeaveDates)
          ? leaveRes.data.approvedLeaveDates
          : [];
        const leaveKeysFromStats = Array.isArray(billRes?.data?.inactiveDayKeys)
          ? billRes.data.inactiveDayKeys
          : [];
        const leaveKeys = leaveKeysFromStats.length ? leaveKeysFromStats : leaveKeysFromRequests;
        setLeaveDates(
          new Set(
            leaveKeys
              .map((key) => extractDayFromKey(key))
              .filter((day) => Number.isInteger(day) && day > 0)
          )
        );

        const requests = Array.isArray(leaveRes?.data?.requests) ? leaveRes.data.requests : [];
        const requestCounts = requests.reduce(
          (acc, request) => {
            const normalized = String(request?.status || "").trim().toLowerCase();
            if (normalized === "pending") acc.pending += 1;
            else if (normalized === "approved") acc.approved += 1;
            else if (normalized === "rejected") acc.rejected += 1;
            return acc;
          },
          { pending: 0, approved: 0, rejected: 0 }
        );
        const latestRequest = requests
          .slice()
          .sort(
            (a, b) =>
              new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
          )[0];
        setLeaveRequestStats({
          total: requests.length,
          pending: requestCounts.pending,
          approved: requestCounts.approved,
          rejected: requestCounts.rejected,
          latestStatus: toTitleCaseStatus(latestRequest?.status),
        });
      } catch (error) {
        console.error("Leaves month fetch error:", error);
        if (!isRefresh) {
          setMemberDetails(null);
          setBillSummary(null);
          setMonthLeaveSummary(null);
          setLeaveDates(new Set());
          setLeaveRequestStats({
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            latestStatus: "",
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId, monthKey]
  );

  const canNavigateToMonth = useCallback(
    async (targetDate) => {
      if (!memberId) return false;
      const targetKey = toMonthKey(targetDate.getFullYear(), targetDate.getMonth());
      try {
        const [billRes, leaveRes] = await Promise.all([
          api.get(`/api/member-monthly-due/${memberId}?month=${targetKey}`),
          api.get(`/api/leave/self/${memberId}/month?month=${targetKey}`),
        ]);

        const bill = billRes?.data || {};
        const leave = leaveRes?.data || {};
        const inactiveDayKeys = Array.isArray(bill?.inactiveDayKeys) ? bill.inactiveDayKeys : [];
        const requests = Array.isArray(leave?.requests) ? leave.requests : [];
        const approvedLeaveDates = Array.isArray(leave?.approvedLeaveDates)
          ? leave.approvedLeaveDates
          : [];

        const hasInactiveDates = inactiveDayKeys.some((key) => hasDateInMonth(key, targetKey));
        const hasApprovedDates = approvedLeaveDates.some((date) => hasDateInMonth(date, targetKey));
        const hasRequestedDates = requests.some((request) => {
          const start = request?.startDate || request?.fromDate || request?.date;
          const end = request?.endDate || request?.toDate || start;
          return hasDateInMonth(start, targetKey) || hasDateInMonth(end, targetKey);
        });

        const hasLeaveData =
          hasInactiveDates ||
          hasApprovedDates ||
          hasRequestedDates ||
          Number(leave?.approvedLeaveCount || 0) > 0 ||
          Number(leave?.pendingRequestCount || 0) > 0;

        return hasLeaveData;
      } catch (error) {
        console.error("Month availability check failed:", error);
        return false;
      }
    },
    [memberId]
  );

  useEffect(() => {
    loadMonthData(false);
  }, [loadMonthData]);

  const leaveTakenDays = leaveDates;
  const leaveStreakRequiredDays = Number(monthLeaveSummary?.leaveStreakRequiredDays || 5);
  const inactiveDaysCount =
    Number(billSummary?.inactiveDays || 0) ||
    Number(monthLeaveSummary?.approvedLeaveCount || 0) ||
    leaveTakenDays.size;
  const leaveBadgeText =
    leaveRequestStats.pending > 0
      ? `${leaveRequestStats.pending} Pending`
      : leaveRequestStats.latestStatus || "No Requests";
  const leaveSummaryText =
    leaveRequestStats.total > 0
      ? `${leaveRequestStats.approved} Approved • ${leaveRequestStats.rejected} Rejected`
      : "No leave requests in this month";
  const nextResetDate = new Date(year, monthIndex + 1, 1);

  const onChangeMonth = async () => {};

  const getScale = (key) => tabScaleRef.current[key] || new Animated.Value(1);
  const animateTab = (key) => {
    const v = getScale(key);
    Animated.sequence([
      Animated.spring(v, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 6 }),
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  };

  const onTabPress = (key) => {
    setActiveTab(key);
    animateTab(key);
    if (embedded) return;
    if (key === "snacks") router.push("/Member/SnackOrderPage");
    if (key === "leaves") router.push("/Member/MemberLeave");
    if (key === "home") router.push("/Member/MemberDashboard");
    if (key === "bill") router.push("/Member/MemberBill");
    if (key === "profile") router.push("/Member/MemberProfile");
  };

  const openApplyWithSelectedDate = () => {
    setIsConfirmApplyModalOpen(true);
  };

  const submitLeaveApplication = async () => {
    if (!memberId) return;
    const todayYmd = toLocalYmd(new Date());

    try {
      setSubmittingLeave(true);
      await api.post("/api/leave/apply", {
        memberId,
        startDate: todayYmd,
        endDate: todayYmd,
        type: "Leave",
      });
      setIsConfirmApplyModalOpen(false);
      await loadMonthData(true);
      setIsLeaveSuccessModalOpen(true);
    } catch (error) {
      console.error("Leave apply error:", error);
      Alert.alert("Error", error?.response?.data?.message || "Failed to submit leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const renderDayTile = ({ item, index }) => {
    const spacingStyle = index % 7 !== 6 ? styles.dayTileSpacing : null;
    if (!item) return <View style={[styles.dayPlaceholder, spacingStyle]} />;
    const isSelected = item === selectedDay;
    const isLeaveTaken = leaveTakenDays.has(item);
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const cellDate = new Date(year, monthIndex, item);
    const isFuture = cellDate > todayOnly;

    return (
      <View
        style={[
          styles.dayTile,
          isFuture
            ? styles.dayTileFuture
            : isLeaveTaken
              ? styles.dayTileLeave
              : styles.dayTileAvailable,
          isSelected && styles.dayTileSelected,
          spacingStyle,
        ]}
      >
        <Text
          style={[
            styles.dayTileText,
            isFuture
              ? styles.dayTileTextFuture
              : isLeaveTaken
                ? styles.dayTileTextLeave
                : styles.dayTileTextAvailable,
            isSelected && styles.dayTileTextSelected,
          ]}
        >
          {item}
        </Text>
      </View>
    );
  };

  const contentBottomPadding = embedded ? 24 : 118;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={embedded ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}
    >
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[styles.pageContent, { paddingBottom: contentBottomPadding }]}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadMonthData(true)}
            tintColor={PRIMARY}
          />
        }
      >
        <View style={[styles.heroHeader, { paddingTop: embedded ? 14 : insets.top + 14 }]}>
          <Ionicons
            name="fast-food-outline"
            size={84}
            color="rgba(255,255,255,0.11)"
            style={styles.patternOne}
          />
          <Ionicons
            name="pizza-outline"
            size={58}
            color="rgba(255,255,255,0.11)"
            style={styles.patternTwo}
          />
          <Ionicons
            name="ice-cream-outline"
            size={44}
            color="rgba(255,255,255,0.10)"
            style={styles.patternThree}
          />

          <View style={styles.heroTopRow}>
            <View style={styles.heroTopRowSpacer} />
            <TouchableOpacity
              style={styles.historyPill}
              activeOpacity={0.9}
              onPress={() => router.push("/Member/LeaveHistoryScreen")}
            >
              <Ionicons name="time-outline" size={14} color={PRIMARY} />
              <Text style={styles.historyPillText}>Leave History</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>My Leaves</Text>
          <Text style={styles.heroSubtitle}>Manage your leave days easily</Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.statsCard}>
                <View style={styles.statsBlock}>
                  <Text style={styles.statsLabel}>Leaves Taken</Text>
                  <Text style={styles.statsValue}>{inactiveDaysCount} Days</Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsBlock}>
                  <Text style={styles.statsLabel}>Leaves Streak Required</Text>
                  <Text style={styles.statsValue}>{leaveStreakRequiredDays} Days</Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsBlock}>
                  <Text style={styles.statsLabel}>Next Reset Date</Text>
                  <Text style={styles.statsValue}>{formatDateLabel(nextResetDate)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <TouchableOpacity
                style={[styles.applyCard, styles.applyCardNoContainer]}
                activeOpacity={0.9}
                onPress={openApplyWithSelectedDate}
              >
                <View style={styles.applyIconBox}>
                  <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
                </View>
                <View style={styles.applyTextWrap}>
                  <Text style={styles.applyTitle}>Apply for Leave</Text>
                  <Text style={styles.applySub}>{leaveSummaryText}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TEXT_MUTE} />
                <View style={[styles.pendingBadge, styles.pendingBadgeOnCard]}>
                  <Text style={styles.pendingBadgeText}>{leaveBadgeText}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity
              style={styles.monthNavBtn}
              activeOpacity={0.88}
              onPress={onChangeMonth}
              disabled
            >
              <Ionicons name="chevron-back" size={18} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              style={styles.monthNavBtn}
              activeOpacity={0.88}
              onPress={onChangeMonth}
              disabled
            >
              <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekStrip}>
            {WEEKDAY_LABELS.map((day) => (
              <Text key={day} style={styles.weekStripText}>
                {day}
              </Text>
            ))}
          </View>

          <FlatList
            data={calendarData}
            keyExtractor={(_, index) => `cell-${index}`}
            renderItem={renderDayTile}
            numColumns={7}
            scrollEnabled={false}
            contentContainerStyle={styles.calendarList}
          />

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.legendText}>Active</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#F59AA4" }]} />
              <Text style={styles.legendText}>Inactive</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#9CA3AF" }]} />
              <Text style={styles.legendText}>Future</Text>
            </View>
          </View>
          <View style={styles.legendSummaryWrap}>
            <Text style={styles.legendSummaryText}>Active, Inactive, Future</Text>
          </View>

          {!loading && !memberDetails && (
            <Text style={styles.emptyHintText}>No member data found for this account.</Text>
          )}
        </View>
      </ScrollView>

      <FullScreenLoading visible={loading && !refreshing} color={PRIMARY} />

      <Modal
        transparent
        animationType="fade"
        visible={isConfirmApplyModalOpen}
        onRequestClose={() => setIsConfirmApplyModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm to apply for leave?</Text>
            <Text style={styles.confirmSubtitle}>Leave start date: {toLocalYmd(new Date())}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                activeOpacity={0.88}
                onPress={() => setIsConfirmApplyModalOpen(false)}
                disabled={submittingLeave}
              >
                <Text style={styles.modalCancelText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSubmitBtn]}
                activeOpacity={0.88}
                onPress={submitLeaveApplication}
                disabled={submittingLeave}
              >
                <Text style={styles.modalSubmitText}>
                  {submittingLeave ? "Submitting..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={isLeaveSuccessModalOpen}
        onRequestClose={() => setIsLeaveSuccessModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Leave request submitted</Text>
            <Text style={styles.confirmSubtitle}>Your leave request has been sent successfully.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSubmitBtn]}
                activeOpacity={0.88}
                onPress={() => setIsLeaveSuccessModalOpen(false)}
              >
                <Text style={styles.modalSubmitText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!embedded && (
        <View style={[styles.bottomBarWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bottomBar}>
            {[
              { key: "snacks", label: "Extra Snacks", icon: "fast-food-outline" },
              { key: "leaves", label: "Leaves", icon: "calendar-outline" },
              { key: "home", label: "Home", icon: "home-outline" },
              { key: "bill", label: "Bill", icon: "receipt-outline" },
              { key: "profile", label: "Profile", icon: "person-outline" },
            ].map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.bottomTab}
                  activeOpacity={0.85}
                  onPress={() => onTabPress(tab.key)}
                >
                  <Animated.View style={{ transform: [{ scale: getScale(tab.key) }] }}>
                    <Ionicons
                      name={tab.icon}
                      size={isActive ? 22 : 19}
                      color={isActive ? PRIMARY : "#94A3B8"}
                    />
                  </Animated.View>
                  <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 0,
  },
  heroHeader: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 14,
    paddingBottom: 90,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTopRowSpacer: {
    width: 34,
    height: 34,
  },
  historyPill: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingVertical: 7,
    paddingHorizontal: 11,
    alignSelf: "flex-end",
  },
  historyPillText: {
    color: "#25515D",
    fontWeight: "700",
    fontSize: 12,
  },
  patternOne: {
    position: "absolute",
    right: -6,
    top: 18,
    transform: [{ rotate: "-8deg" }],
  },
  patternTwo: {
    position: "absolute",
    left: 132,
    top: 18,
    transform: [{ rotate: "12deg" }],
  },
  patternThree: {
    position: "absolute",
    right: 58,
    top: 54,
    transform: [{ rotate: "8deg" }],
  },
  heroTitle: {
    marginTop: 25,
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "500",
  },
  mainCard: {
    minHeight: 700,
    marginTop: -30,
    marginHorizontal: 0,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 9,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  monthRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#E9F7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#16233B",
  },
  weekStrip: {
    flexDirection: "row",
    backgroundColor: "#F3F5F8",
    borderRadius: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  weekStripText: {
    flex: 1,
    textAlign: "center",
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  summaryCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#EAEFF5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#EDF2F7",
  },
  pendingBadge: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E08C94",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#FFF5F6",
  },
  pendingBadgeOnCard: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  pendingBadgeText: {
    color: "#9F2430",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarList: {
    marginTop: 8,
  },
  dayPlaceholder: {
    width: "13%",
    aspectRatio: 1,
    marginBottom: 5,
  },
  dayTile: {
    width: "13%",
    aspectRatio: 1,
    borderRadius: 7,
    borderWidth: 1.1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  dayTileSpacing: {
    marginRight: "1.5%",
  },
  dayTileAvailable: {
    backgroundColor: GREEN_BG,
    borderColor: "#B7EBD1",
  },
  dayTileLeave: {
    backgroundColor: RED_BG,
    borderColor: "#F8CDD2",
  },
  dayTileFuture: {
    backgroundColor: GREY_BG,
    borderColor: "#D1D5DB",
  },
  dayTileSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#1F2937",
    borderWidth: 2,
  },
  dayTileText: {
    fontSize: 15,
    fontWeight: "700",
  },
  dayTileTextAvailable: {
    color: GREEN_TEXT,
  },
  dayTileTextLeave: {
    color: RED_TEXT,
  },
  dayTileTextFuture: {
    color: GREY_TEXT,
  },
  dayTileTextSelected: {
    color: "#111827",
  },
  legendRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },
  legendSummaryText: {
    textAlign: "center",
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  legendSummaryWrap: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: "center",
  },
  applyCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBF0F5",
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  applyCardNoContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  applyIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#E8F8F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  applyTextWrap: {
    flex: 1,
  },
  applyTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  applySub: {
    marginTop: 2,
    color: TEXT_MUTE,
    fontSize: 11,
    fontWeight: "500",
  },
  statsCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    paddingVertical: 9,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  statsBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsLabel: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 10,
    fontWeight: "500",
  },
  statsValue: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  statsDivider: {
    width: 1,
    height: "78%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  emptyHintText: {
    marginTop: 10,
    textAlign: "center",
    color: TEXT_MUTE,
    fontSize: 12,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  confirmTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "800",
  },
  confirmSubtitle: {
    marginTop: 6,
    color: TEXT_MUTE,
    fontSize: 12,
    fontWeight: "600",
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  modalCancelBtn: {
    backgroundColor: "#F1F5F9",
  },
  modalSubmitBtn: {
    backgroundColor: PRIMARY,
  },
  modalCancelText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBarWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
  },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomTabLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "700",
  },
  bottomTabLabelActive: {
    color: PRIMARY,
  },
});
