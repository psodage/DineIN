import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import FullScreenLoading from "../../components/FullScreenLoading";

const GREEN = "#4CAF50";
const RED = "#F44336";
const GREY = "#BDBDBD";
const CELL_SIZE = 44;

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isFutureDate(date) {
  return startOfDay(date) > startOfDay(new Date());
}

function isBeforeDate(date, boundaryDate) {
  if (!date || !boundaryDate) return false;
  return startOfDay(date) < startOfDay(boundaryDate);
}

function buildCalendarCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startPad = first.getDay();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ type: "empty", key: `pad-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      type: "day",
      date: new Date(year, monthIndex, d),
      key: `day-${year}-${monthIndex}-${d}`,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ type: "empty", key: `trail-${cells.length}` });
  }
  return cells;
}

function chunkRows(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function collectDays(start, end) {
  const out = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= endOnly) {
    out.push(formatYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_MR = ["रवि", "सोम", "मंगळ", "बुध", "गुरु", "शुक्र", "शनि"];

export default function MemberActivityCalendar() {
  const router = useRouter();
  const { month } = useLocalSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  const formatYM = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const viewDate = useMemo(() => {
    const raw = String(month || "").trim();
    if (/^\d{4}-\d{2}$/.test(raw)) {
      const [yy, mm] = raw.split("-").map(Number);
      if (!Number.isNaN(yy) && !Number.isNaN(mm) && mm >= 1 && mm <= 12) {
        return new Date(yy, mm - 1, 1);
      }
    }
    return new Date();
  }, [month]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [joiningDateObj, setJoiningDateObj] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();
  const monthTitle = useMemo(() => {
    const d = new Date(year, monthIndex, 1);
    return d.toLocaleDateString(language === "mr" ? "mr-IN" : "en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [year, monthIndex, language]);

  const todayMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const joinMonthStart = useMemo(() => {
    if (!joiningDateObj) return null;
    return new Date(joiningDateObj.getFullYear(), joiningDateObj.getMonth(), 1);
  }, [joiningDateObj]);

  const canGoPrev = useMemo(() => {
    if (!joinMonthStart) return true; // allow until we know joining date
    const currentViewMonthStart = new Date(year, monthIndex, 1);
    return currentViewMonthStart.getTime() > joinMonthStart.getTime();
  }, [joinMonthStart, year, monthIndex]);

  const canGoNext = useMemo(() => {
    const currentViewMonthStart = new Date(year, monthIndex, 1);
    return currentViewMonthStart.getTime() < todayMonthStart.getTime();
  }, [todayMonthStart, year, monthIndex]);

  const goToMonth = (nextDate) => {
    const nextMonthStart = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    if (joinMonthStart && nextMonthStart.getTime() < joinMonthStart.getTime()) return;
    if (nextMonthStart.getTime() > todayMonthStart.getTime()) return;

    router.replace({
      pathname: "/Member/MemberActivityCalendar",
      params: { month: formatYM(nextMonthStart) },
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!isAuthenticated || !user?.id) return;

    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [memberRes, leaveRes] = await Promise.all([
          api.get(`/api/members/${user.id}`),
          api.get(`/api/leave/student/${user.id}`),
        ]);

        if (!mounted) return;
        const member = memberRes?.data || {};
        const leaves = Array.isArray(leaveRes?.data) ? leaveRes.data : [];
        setJoiningDateObj(
          member?.joiningDate && !Number.isNaN(new Date(member.joiningDate).getTime())
            ? new Date(member.joiningDate)
            : null
        );
        setLeaveRequests(leaves);
      } catch (err) {
        console.error("Member activity calendar fetch error:", err);
        if (!mounted) return;
        Alert.alert(
          t("alert_error"),
          err?.response?.data?.message ||
            (language === "mr"
              ? "क्रियाकलाप कॅलेंडर लोड करता आला नाही"
              : "Failed to load activity calendar")
        );
        setJoiningDateObj(null);
        setLeaveRequests([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, user?.id, router, language, t]);

  const leaveKeys = useMemo(() => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const set = new Set();

    leaveRequests
      .filter((r) => String(r?.type || "").toLowerCase() === "leave")
      .filter((r) => String(r?.status || "").toLowerCase() === "approved")
      .forEach((r) => {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
        if (start > monthEnd || end < monthStart) return;

        const clippedStart = start < monthStart ? monthStart : start;
        const clippedEnd = end > monthEnd ? monthEnd : end;
        collectDays(clippedStart, clippedEnd).forEach((d) => set.add(d));
      });

    return set;
  }, [leaveRequests, year, monthIndex]);

  const weekDays = language === "mr" ? WEEKDAYS_MR : WEEKDAYS_EN;
  const cells = useMemo(() => buildCalendarCells(year, monthIndex), [year, monthIndex]);
  const rows = useMemo(() => chunkRows(cells, 7), [cells]);

  const { activeDaysCount, leaveDaysCount } = useMemo(() => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    let active = 0;
    let leave = 0;

    for (
      let d = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
      d <= monthEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const isBeforeJoin = isBeforeDate(d, joiningDateObj);
      if (isBeforeJoin || isFutureDate(d)) continue;

      const key = formatYMD(d);
      if (leaveKeys.has(key)) {
        leave += 1;
      } else {
        active += 1;
      }
    }

    return { activeDaysCount: active, leaveDaysCount: leave };
  }, [year, monthIndex, joiningDateObj, leaveKeys]);

  if (authLoading || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <FullScreenLoading visible color="#111827" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {language === "mr" ? "क्रियाकलाप कॅलेंडर" : "Activity calendar"}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity
          style={[styles.monthNavButton, !canGoPrev && styles.monthNavButtonDisabled]}
          onPress={() => goToMonth(new Date(year, monthIndex - 1, 1))}
          disabled={!canGoPrev}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={canGoPrev ? "#111827" : "#9CA3AF"} />
        </TouchableOpacity>

        <Text style={styles.monthLabel}>{monthTitle}</Text>

        <TouchableOpacity
          style={[styles.monthNavButton, !canGoNext && styles.monthNavButtonDisabled]}
          onPress={() => goToMonth(new Date(year, monthIndex + 1, 1))}
          disabled={!canGoNext}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={canGoNext ? "#111827" : "#9CA3AF"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
          <Text style={styles.legendText}>{language === "mr" ? "सक्रिय" : "Active"}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RED }]} />
          <Text style={styles.legendText}>{language === "mr" ? "रजेवर" : "On leave"}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GREY }]} />
          <Text style={styles.legendText}>{language === "mr" ? "भविष्य" : "Future"}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {language === "mr" ? "सक्रिय दिवस:" : "Active days:"} {activeDaysCount}
        </Text>
        <Text style={styles.summaryText}>
          {language === "mr" ? "रजेचे दिवस:" : "Leave days:"} {leaveDaysCount}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarWrap}>
          <View style={styles.weekRow}>
            {weekDays.map((w) => (
              <Text key={w} style={styles.weekdayLabel}>
                {w}
              </Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={`row-${ri}`} style={styles.gridRow}>
              {row.map((item) => {
                if (item.type === "empty") {
                  return (
                    <View key={item.key} style={styles.cell}>
                      <View style={styles.cellInnerEmpty} />
                    </View>
                  );
                }

                const isBeforeJoin = isBeforeDate(item.date, joiningDateObj);
                const ymd = formatYMD(item.date);
                let bg = GREEN;
                if (isBeforeJoin || isFutureDate(item.date)) bg = GREY;
                else if (leaveKeys.has(ymd)) bg = RED;

                const isGrey = bg === GREY;
                return (
                  <View key={item.key} style={styles.cell}>
                    <View style={[styles.cellInner, { backgroundColor: bg }]}>
                      <Text style={[styles.cellText, isGrey && styles.cellTextFuture]}>
                        {item.date.getDate()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <FullScreenLoading visible={loading} color="#111827" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  monthNavButton: {
    padding: 8,
  },
  monthNavButtonDisabled: {
    opacity: 0.7,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginHorizontal: 8,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: "#374151",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  summaryText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  calendarWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  cell: {
    flex: 1,
    padding: 3,
  },
  cellInner: {
    flex: 1,
    aspectRatio: 1,
    minHeight: CELL_SIZE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cellInnerEmpty: {
    flex: 1,
    minHeight: CELL_SIZE,
    opacity: 0,
  },
  cellText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cellTextFuture: {
    color: "#424242",
  },
});
