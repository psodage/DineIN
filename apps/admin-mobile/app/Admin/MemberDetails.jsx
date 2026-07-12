import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  useWindowDimensions,
  RefreshControl,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../LanguageContext";
import { displayMealPlanMr, displayStatusMr } from "../../lib/memberLabelsMr";
import {
  dateToYearMonth,
  getMaxSelectableYearMonth,
  getPolicyMinYearMonth,
  isBeforeJuneYearMonth,
  shiftMemberMonthDate,
  snapToJuneYearMonth,
  yearMonthToDate,
} from "../../lib/monthNavigation";

// ─── Utility helpers ───────────────────────────────────────────────────────────

const formatDate = (value, fallback = "-") => {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `Rs. ${amount.toFixed(2)}`;
};

const toDateOnlyLocal = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const getMonthParam = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const normalizeMonthDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const toSafeAmount = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
};

const isValidMonthDate = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime());

const buildCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#14B8A6",
  "#F97316", "#06B6D4",
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getMembershipDuration = (joiningDate, language) => {
  if (!joiningDate) return null;
  const join = new Date(joiningDate);
  if (Number.isNaN(join.getTime())) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - join.getFullYear()) * 12 +
    (now.getMonth() - join.getMonth());
  if (months < 1) return language === "en" ? "< 1 month" : "< १ महिना";
  if (months === 1) return language === "en" ? "1 month" : "१ महिना";
  return language === "en" ? `${months} months` : `${months} महिने`;
};

// ─── Weekday labels ────────────────────────────────────────────────────────────

const EN_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MR_WEEKDAYS = ["र", "सो", "मं", "बु", "गु", "शु", "श"];

// ─── DetailItem sub-component ──────────────────────────────────────────────────

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailItemIconWrap}>
        <Ionicons name={icon} size={14} color="#6366F1" />
      </View>
      <View style={styles.detailItemContent}>
        <Text style={styles.detailItemLabel}>{label}</Text>
        <Text style={styles.detailItemValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function MemberDetails() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calendarDayUpdatingKeys, setCalendarDayUpdatingKeys] = useState([]);
  const [monthlyDue, setMonthlyDue] = useState(0);
  const [totalMonthlyDue, setTotalMonthlyDue] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const dueRefreshTimerRef = useRef(null);
  const latestMonthlyDueReqRef = useRef(0);
  const latestTotalDueReqRef = useRef(0);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [form, setForm] = useState({
    name: "",
    roomOwnerName: "",
    phone: "",
    email: "",
    joiningDate: "",
    status: "Active",
    mealPlan: "Lunch",
  });
  const [leaveDates, setLeaveDates] = useState([]);
  const [monthDate, setMonthDate] = useState(
    () => normalizeMonthDate(new Date()) || new Date()
  );
  const [refreshing, setRefreshing] = useState(false);

  const memberIdValue = String(memberId || "").trim();
  const monthParam = useMemo(() => getMonthParam(monthDate), [monthDate]);
  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const leaveDateSet = useMemo(() => new Set(leaveDates), [leaveDates]);
  const policyMinMonth = useMemo(
    () => normalizeMonthDate(yearMonthToDate(getPolicyMinYearMonth())),
    []
  );
  const minMonth = useMemo(() => {
    const joinMin = normalizeMonthDate(member?.joiningDate || new Date());
    if (!joinMin) return policyMinMonth;
    if (!policyMinMonth) return joinMin;
    return joinMin > policyMinMonth ? joinMin : policyMinMonth;
  }, [member?.joiningDate, policyMinMonth]);
  const maxMonth = useMemo(() => normalizeMonthDate(new Date()), []);

  // ── Pulse animation for active status dot ─────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ── Toast system ───────────────────────────────────────────────────────────
  const showToast = useCallback(
    (message, type = "success") => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ message, type });
      Animated.spring(toastAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
      toastTimerRef.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 3000);
    },
    [toastAnim]
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Calendar summary stats ─────────────────────────────────────────────────
  const calendarStats = useMemo(() => {
    const today = toDateOnlyLocal(new Date());
    let active = 0;
    let leave = 0;
    const joinDate =
      member?.joiningDate && !Number.isNaN(new Date(member.joiningDate).getTime())
        ? toDateOnlyLocal(new Date(member.joiningDate))
        : null;
    for (const cell of calendarCells) {
      if (!cell) continue;
      const isFuture = toDateOnlyLocal(cell) > today;
      const isBeforeJoining =
        joinDate && toDateOnlyLocal(cell).getTime() < joinDate.getTime();
      if (isFuture || isBeforeJoining) continue;
      const dateKey = formatDate(cell, "");
      if (leaveDateSet.has(dateKey)) leave++;
      else active++;
    }
    return { active, leave };
  }, [calendarCells, leaveDateSet, member?.joiningDate]);

  const todayKey = useMemo(() => formatDate(new Date(), ""), []);
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      monthDate.getFullYear() === now.getFullYear() &&
      monthDate.getMonth() === now.getMonth()
    );
  }, [monthDate]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchMemberDetails = useCallback(async () => {
    if (!memberIdValue) {
      setLoading(false);
      Alert.alert(
        "Error",
        language === "en" ? "Member not found" : "सदस्य सापडला नाही"
      );
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/members/${memberIdValue}`);
      const payload = res.data || null;
      setMember(payload);
      setForm({
        name: String(payload?.name || "").trim(),
        roomOwnerName: String(
          payload?.roomOwnerName || payload?.roomNumber || ""
        ).trim(),
        phone: String(payload?.phone || "").trim(),
        email: String(payload?.email || payload?.userId?.email || "").trim(),
        joiningDate: formatDate(payload?.joiningDate, ""),
        status: payload?.status === "Inactive" ? "Inactive" : "Active",
        mealPlan: ["Lunch", "Dinner", "Both"].includes(payload?.mealPlan)
          ? payload.mealPlan
          : "Lunch",
      });
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to load member details"
            : "सदस्य तपशील लोड करता आला नाही")
      );
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [memberIdValue, language]);

  const fetchLeaveCalendar = useCallback(async () => {
    if (!memberIdValue) return;
    try {
      setCalendarLoading(true);
      const res = await api.get(`/api/leave/member/${memberIdValue}`, {
        params: { month: monthParam },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const normalized = rows
        .map((row) => String(row?.date || "").slice(0, 10))
        .filter(Boolean);
      setLeaveDates(normalized);
    } catch (err) {
      setLeaveDates([]);
      Alert.alert(
        "Error",
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to load activity calendar"
            : "क्रियाकलाप कॅलेंडर लोड करता आले नाही")
      );
    } finally {
      setCalendarLoading(false);
    }
  }, [memberIdValue, monthParam, language]);

  const fetchMonthlyDue = useCallback(async () => {
    if (!memberIdValue) return;
    const requestId = latestMonthlyDueReqRef.current + 1;
    latestMonthlyDueReqRef.current = requestId;
    try {
      const res = await api.get(`/api/members/${memberIdValue}/monthly-due`, {
        params: { month: monthParam },
      });
      if (latestMonthlyDueReqRef.current !== requestId) return;
      const payload = res?.data || {};
      setMonthlyDue(
        toSafeAmount(payload?.due, payload?.remainingForMonth, payload?.monthlyDue, 0)
      );
    } catch (_err) {
      if (latestMonthlyDueReqRef.current !== requestId) return;
      setMonthlyDue(0);
    }
  }, [memberIdValue, monthParam]);

  const fetchTotalMonthlyDue = useCallback(async () => {
    if (!memberIdValue) return;
    const requestId = latestTotalDueReqRef.current + 1;
    latestTotalDueReqRef.current = requestId;
    try {
      const res = await api.get(`/api/members/${memberIdValue}/monthly-due-total`);
      if (latestTotalDueReqRef.current !== requestId) return;
      const payload = res?.data || {};
      setTotalMonthlyDue(toSafeAmount(payload?.totalDue, payload?.due, 0));
    } catch (_err) {
      if (latestTotalDueReqRef.current !== requestId) return;
      setTotalMonthlyDue(0);
    }
  }, [memberIdValue]);

  const scheduleDueRefresh = useCallback(() => {
    if (dueRefreshTimerRef.current) clearTimeout(dueRefreshTimerRef.current);
    dueRefreshTimerRef.current = setTimeout(() => {
      fetchMonthlyDue();
      fetchTotalMonthlyDue();
    }, 700);
  }, [fetchMonthlyDue, fetchTotalMonthlyDue]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) fetchMemberDetails();
  }, [authLoading, isAuthenticated, fetchMemberDetails, router]);

  useEffect(() => {
    if (isAuthenticated && memberIdValue) {
      fetchLeaveCalendar();
      fetchMonthlyDue();
      fetchTotalMonthlyDue();
    }
  }, [
    isAuthenticated,
    memberIdValue,
    fetchLeaveCalendar,
    fetchMonthlyDue,
    fetchTotalMonthlyDue,
  ]);

  useEffect(() => {
    if (!isValidMonthDate(monthDate)) {
      setMonthDate(maxMonth || new Date());
      return;
    }
    const currentYm = getMaxSelectableYearMonth();
    let ym = dateToYearMonth(monthDate);
    if (ym !== currentYm && isBeforeJuneYearMonth(ym)) {
      ym = snapToJuneYearMonth(ym);
    }
    let next = yearMonthToDate(ym);
    if (isValidMonthDate(minMonth) && next < minMonth) next = minMonth;
    if (isValidMonthDate(maxMonth) && next > maxMonth) next = maxMonth;
    if (next.getTime() !== monthDate.getTime()) setMonthDate(next);
  }, [monthDate, minMonth, maxMonth]);

  // ── Derived display values ─────────────────────────────────────────────────
  const title =
    language === "mr"
      ? member?.nameMr || member?.name || "सदस्य तपशील"
      : member?.name || member?.nameMr || "Member Details";
  const roomOwner =
    language === "mr"
      ? member?.roomOwnerNameMr || member?.roomOwnerName || member?.roomNumber || "-"
      : member?.roomOwnerName || member?.roomOwnerNameMr || member?.roomNumber || "-";
  const monthLabel = monthDate.toLocaleDateString(
    language === "mr" ? "mr-IN" : "en-IN",
    { month: "long", year: "numeric" }
  );
  const canGoPrev = !minMonth || monthDate > minMonth;
  const canGoNext = !maxMonth || monthDate < maxMonth;
  const weekdays = language === "mr" ? MR_WEEKDAYS : EN_WEEKDAYS;

  const avatarColor = useMemo(
    () => getAvatarColor(member?.name || ""),
    [member?.name]
  );
  const initials = useMemo(
    () => getInitials(member?.name || ""),
    [member?.name]
  );
  const membershipDuration = useMemo(
    () => getMembershipDuration(member?.joiningDate, language),
    [member?.joiningDate, language]
  );

  // ── Form handlers ──────────────────────────────────────────────────────────
  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validateForm = () => {
    const errors = {};
    if (!String(form.name || "").trim()) {
      errors.name =
        language === "en" ? "Name is required" : "नाव आवश्यक आहे";
    }
    if (!String(form.roomOwnerName || "").trim()) {
      errors.roomOwnerName =
        language === "en"
          ? "Room owner is required"
          : "रूम मालक आवश्यक आहे";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSave = async () => {
    if (!validateForm()) return;
    const payload = {
      name: String(form.name || "").trim(),
      roomOwnerName: String(form.roomOwnerName || "").trim(),
      phone: String(form.phone || "").trim(),
      email: String(form.email || "").trim(),
      joiningDate: String(form.joiningDate || "").trim(),
      status: form.status === "Inactive" ? "Inactive" : "Active",
      mealPlan: ["Lunch", "Dinner", "Both"].includes(form.mealPlan)
        ? form.mealPlan
        : "Lunch",
    };
    try {
      setSaving(true);
      await api.put(`/api/members/${memberIdValue}`, payload);
      setIsEditing(false);
      setFormErrors({});
      await Promise.all([
        fetchMemberDetails(),
        fetchLeaveCalendar(),
        fetchMonthlyDue(),
        fetchTotalMonthlyDue(),
      ]);
      showToast(
        language === "en"
          ? "Member details updated successfully."
          : "सदस्य तपशील यशस्वीरित्या अपडेट झाले.",
        "success"
      );
    } catch (err) {
      Alert.alert(
        language === "en" ? "Error" : "त्रुटी",
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to update member details."
            : "सदस्य तपशील अपडेट करता आले नाहीत.")
      );
    } finally {
      setSaving(false);
    }
  };

  const onCancelEdit = () => {
    setIsEditing(false);
    setFormErrors({});
    setForm({
      name: String(member?.name || "").trim(),
      roomOwnerName: String(
        member?.roomOwnerName || member?.roomNumber || ""
      ).trim(),
      phone: String(member?.phone || "").trim(),
      email: String(member?.email || member?.userId?.email || "").trim(),
      joiningDate: formatDate(member?.joiningDate, ""),
      status: member?.status === "Inactive" ? "Inactive" : "Active",
      mealPlan: ["Lunch", "Dinner", "Both"].includes(member?.mealPlan)
        ? member.mealPlan
        : "Lunch",
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      language === "en" ? "Delete member?" : "सदस्य हटवायचा?",
      language === "en"
        ? "This action cannot be undone."
        : "ही क्रिया पूर्ववत करता येणार नाही.",
      [
        { text: language === "en" ? "Cancel" : "रद्द करा", style: "cancel" },
        {
          text: language === "en" ? "Delete" : "हटवा",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await api.delete(`/api/members/${memberIdValue}`);
              showToast(
                language === "en"
                  ? "Member deleted successfully."
                  : "सदस्य यशस्वीरित्या हटवला.",
                "success"
              );
              setTimeout(() => router.replace("/Admin/ManageMembers"), 1500);
            } catch (err) {
              Alert.alert(
                language === "en" ? "Error" : "त्रुटी",
                err?.response?.data?.message ||
                  (language === "en"
                    ? "Failed to delete member."
                    : "सदस्य हटवता आला नाही.")
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const cellSize = useMemo(() => {
    const horizontalOuterPadding = 16 * 2;
    const cardInnerPadding = 16 * 2;
    const cellMargin = 2; // 1px each side
    const usableWidth = Math.max(
      screenWidth - horizontalOuterPadding - cardInnerPadding,
      280
    );
    return Math.floor((usableWidth - cellMargin * 7) / 7);
  }, [screenWidth]);

  const onToggleCalendarDay = useCallback(
    async (dateKey, nextInactive) => {
      if (!dateKey) return;
      if (calendarDayUpdatingKeys.includes(dateKey)) return;
      const previous = leaveDates;
      setLeaveDates((prev) => {
        const set = new Set(prev || []);
        if (nextInactive) set.add(dateKey);
        else set.delete(dateKey);
        return Array.from(set).sort();
      });
      try {
        setCalendarDayUpdatingKeys((keys) =>
          Array.from(new Set([...(keys || []), dateKey]))
        );
        const res = await api.put(
          `/api/leave/member/${memberIdValue}/calendar-day`,
          { date: dateKey, inactive: nextInactive },
          { params: { fast: 1 } }
        );
        if (Number.isFinite(Number(res?.data?.due)))
          setMonthlyDue(Number(res.data.due));
        if (Number.isFinite(Number(res?.data?.totalDue)))
          setTotalMonthlyDue(Number(res.data.totalDue));
        if (res?.data?.memberStatus) {
          const nextMemberStatus =
            res.data.memberStatus === "Inactive" ? "Inactive" : "Active";
          const nextMemberStatusMr = String(
            res?.data?.memberStatusMr || ""
          ).trim();
          setMember((prev) =>
            prev
              ? {
                  ...prev,
                  status: nextMemberStatus,
                  statusMr: nextMemberStatusMr || prev.statusMr || "",
                }
              : prev
          );
          setForm((prev) => ({ ...prev, status: nextMemberStatus }));
        }
        scheduleDueRefresh();
      } catch (err) {
        setLeaveDates(previous);
        Alert.alert(
          language === "en" ? "Error" : "त्रुटी",
          err?.response?.data?.message ||
            (language === "en"
              ? "Failed to update calendar day."
              : "कॅलेंडर दिवस अपडेट करता आला नाही.")
        );
      } finally {
        setCalendarDayUpdatingKeys((keys) =>
          (keys || []).filter((k) => k !== dateKey)
        );
      }
    },
    [calendarDayUpdatingKeys, language, leaveDates, memberIdValue, scheduleDueRefresh]
  );

  const onRefresh = useCallback(async () => {
    if (!memberIdValue) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchMemberDetails(),
        fetchLeaveCalendar(),
        fetchMonthlyDue(),
        fetchTotalMonthlyDue(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    memberIdValue,
    fetchMemberDetails,
    fetchLeaveCalendar,
    fetchMonthlyDue,
    fetchTotalMonthlyDue,
  ]);

  useEffect(() => {
    return () => {
      if (dueRefreshTimerRef.current) clearTimeout(dueRefreshTimerRef.current);
    };
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (authLoading || !isAuthenticated || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!member) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {language === "en" ? "Member Profile" : "सदस्य प्रोफाइल"}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="person-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyStateTitle}>
            {language === "en" ? "Member not found" : "सदस्य सापडला नाही"}
          </Text>
          <Text style={styles.emptyStateSubtitle}>
            {language === "en"
              ? "The member may have been deleted or does not exist."
              : "सदस्य हटवला असेल किंवा अस्तित्वात नसेल."}
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyStateButtonText}>
              {language === "en" ? "Go Back" : "मागे जा"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={language === "en" ? "Go back" : "मागे जा"}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {language === "en" ? "Member Profile" : "सदस्य प्रोफाइल"}
        </Text>
        <TouchableOpacity
          style={[styles.headerActionButton, isEditing && styles.headerActionButtonActive]}
          onPress={() => (isEditing ? onCancelEdit() : setIsEditing(true))}
          activeOpacity={0.7}
          disabled={saving || deleting}
          accessibilityRole="button"
          accessibilityLabel={
            isEditing
              ? language === "en" ? "Cancel editing" : "संपादन रद्द करा"
              : language === "en" ? "Edit member" : "सदस्य संपादित करा"
          }
        >
          <Ionicons
            name={isEditing ? "close-outline" : "create-outline"}
            size={20}
            color={isEditing ? "#DC2626" : "#6366F1"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >

        {/* ── Profile Card (tappable → opens Details Modal) ──────────── */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.82}
          onPress={() => setShowDetailsModal(true)}
          accessibilityRole="button"
          accessibilityLabel={language === "en" ? "View member details" : "सदस्य तपशील पाहा"}
        >
          {/* Initials Avatar */}
          <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>

          {/* Name + Status + Duration */}
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>{title}</Text>

            <View style={styles.statusRow}>
              {/* Pulse dot */}
              <View style={styles.pulseWrapper}>
                {member?.status !== "Inactive" && (
                  <Animated.View
                    style={[
                      styles.pulseDot,
                      {
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.8],
                          outputRange: [0.45, 0],
                        }),
                      },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.statusDot,
                    member?.status === "Inactive"
                      ? styles.dotInactive
                      : styles.dotActive,
                  ]}
                />
              </View>
              <View
                style={[
                  styles.statusBadge,
                  member?.status === "Inactive"
                    ? styles.badgeInactive
                    : styles.badgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    member?.status === "Inactive"
                      ? styles.badgeInactiveText
                      : styles.badgeActiveText,
                  ]}
                >
                  {displayStatusMr(language, member?.status || "Active", member?.statusMr)}
                </Text>
              </View>
            </View>

            {membershipDuration && (
              <Text style={styles.membershipDuration}>
                {language === "en"
                  ? `Member for ${membershipDuration}`
                  : `${membershipDuration} पासून सदस्य`}
              </Text>
            )}

            {/* Tap hint */}
            <View style={styles.tapHint}>
              <Ionicons name="chevron-forward" size={11} color="#6366F1" />
              <Text style={styles.tapHintText}>
                {language === "en" ? "Tap to view details" : "तपशील पाहण्यासाठी टॅप करा"}
              </Text>
            </View>
          </View>

          {/* Total Due chip */}
          <View
            style={[
              styles.dueChip,
              totalMonthlyDue > 0 ? styles.dueChipRed : styles.dueChipGreen,
            ]}
          >
            <Text style={styles.dueChipLabel}>
              {language === "en" ? "Total Due" : "एकूण बाकी"}
            </Text>
            <Text
              style={[
                styles.dueChipAmount,
                totalMonthlyDue > 0 ? styles.dueAmountRed : styles.dueAmountGreen,
              ]}
            >
              {formatCurrency(totalMonthlyDue)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Details Modal ─────────────────────────────────────────────── */}
        <Modal
          visible={showDetailsModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!isEditing) setShowDetailsModal(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => { if (!isEditing) setShowDetailsModal(false); }}
            />
            <View style={styles.modalSheet}>
              {/* Sheet handle */}
              <View style={styles.sheetHandle} />

              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={[styles.modalAvatar, { backgroundColor: avatarColor }]}>
                    <Text style={styles.modalAvatarInitials}>{initials}</Text>
                  </View>
                  <View>
                    <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.modalSubtitle}>
                      {language === "en" ? "Member Details" : "सदस्य तपशील"}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalHeaderActions}>
                  {!isEditing && (
                    <TouchableOpacity
                      style={styles.modalEditBtn}
                      onPress={() => setIsEditing(true)}
                      disabled={saving || deleting}
                      accessibilityRole="button"
                    >
                      <Ionicons name="create-outline" size={16} color="#6366F1" />
                      <Text style={styles.modalEditBtnText}>
                        {language === "en" ? "Edit" : "संपादित"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => {
                      if (isEditing) onCancelEdit();
                      setShowDetailsModal(false);
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {isEditing ? (
                  /* ── Edit Form inside Modal ─────────────────── */
                  <View style={styles.editWrap}>

                    {/* Name */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Member Name" : "सदस्य नाव"}
                      </Text>
                      <TextInput
                        style={[styles.input, formErrors.name && styles.inputError]}
                        placeholder={language === "en" ? "Enter member name" : "सदस्य नाव टाका"}
                        placeholderTextColor="#9CA3AF"
                        value={form.name}
                        onChangeText={(v) => updateForm("name", v)}
                        accessibilityLabel={language === "en" ? "Member name" : "सदस्य नाव"}
                      />
                      {formErrors.name && (
                        <Text style={styles.errorText}>{formErrors.name}</Text>
                      )}
                    </View>

                    {/* Room Owner */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Room Owner Name" : "रूम मालक नाव"}
                      </Text>
                      <TextInput
                        style={[styles.input, formErrors.roomOwnerName && styles.inputError]}
                        placeholder={language === "en" ? "Enter room owner name" : "रूम मालक नाव टाका"}
                        placeholderTextColor="#9CA3AF"
                        value={form.roomOwnerName}
                        onChangeText={(v) => updateForm("roomOwnerName", v)}
                        accessibilityLabel={language === "en" ? "Room owner name" : "रूम मालक नाव"}
                      />
                      {formErrors.roomOwnerName && (
                        <Text style={styles.errorText}>{formErrors.roomOwnerName}</Text>
                      )}
                    </View>

                    {/* Phone */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Phone" : "फोन"}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder={language === "en" ? "Enter phone number" : "फोन नंबर टाका"}
                        placeholderTextColor="#9CA3AF"
                        value={form.phone}
                        onChangeText={(v) => updateForm("phone", v)}
                        keyboardType="phone-pad"
                        accessibilityLabel={language === "en" ? "Phone number" : "फोन नंबर"}
                      />
                    </View>

                    {/* Email */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Email" : "ईमेल"}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder={language === "en" ? "Enter email address" : "ईमेल टाका"}
                        placeholderTextColor="#9CA3AF"
                        value={form.email}
                        onChangeText={(v) => updateForm("email", v)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        accessibilityLabel={language === "en" ? "Email address" : "ईमेल"}
                      />
                    </View>

                    {/* Joining Date (read-only) */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Joining Date" : "जॉइनिंग तारीख"}
                      </Text>
                      <View style={[styles.input, styles.readonlyInputRow]}>
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color="#9CA3AF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.readonlyInputText}>
                          {form.joiningDate || "-"}
                        </Text>
                      </View>
                    </View>

                    {/* Meal Plan toggle */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Meal Plan" : "जेवण योजना"}
                      </Text>
                      <View style={styles.toggleRow}>
                        {["Lunch", "Dinner", "Both"].map((plan) => (
                          <TouchableOpacity
                            key={plan}
                            style={[
                              styles.toggleChip,
                              form.mealPlan === plan && styles.toggleChipActive,
                            ]}
                            onPress={() => updateForm("mealPlan", plan)}
                            accessibilityRole="button"
                            accessibilityLabel={plan}
                            accessibilityState={{ selected: form.mealPlan === plan }}
                          >
                            <Text
                              style={[
                                styles.toggleChipText,
                                form.mealPlan === plan && styles.toggleChipTextActive,
                              ]}
                            >
                              {language === "en"
                                ? plan
                                : plan === "Lunch"
                                ? "दुपार"
                                : plan === "Dinner"
                                ? "रात्र"
                                : "दोन्ही"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Status toggle */}
                    <View>
                      <Text style={styles.inputLabel}>
                        {language === "en" ? "Status" : "स्थिती"}
                      </Text>
                      <View style={styles.toggleRow}>
                        {["Active", "Inactive"].map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.toggleChip,
                              form.status === s &&
                                (s === "Active"
                                  ? styles.toggleChipGreen
                                  : styles.toggleChipRed),
                            ]}
                            onPress={() => updateForm("status", s)}
                            accessibilityRole="button"
                            accessibilityLabel={s}
                            accessibilityState={{ selected: form.status === s }}
                          >
                            <Text
                              style={[
                                styles.toggleChipText,
                                form.status === s &&
                                  (s === "Active"
                                    ? styles.toggleChipTextGreen
                                    : styles.toggleChipTextRed),
                              ]}
                            >
                              {language === "en"
                                ? s
                                : s === "Active"
                                ? "सक्रिय"
                                : "निष्क्रिय"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Save / Cancel */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.saveButton,
                          saving && styles.actionDisabled,
                        ]}
                        onPress={async () => {
                          await onSave();
                          setShowDetailsModal(false);
                        }}
                        disabled={saving || deleting}
                        accessibilityRole="button"
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionButtonText}>
                            {language === "en" ? "Save Changes" : "सेव्ह करा"}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={onCancelEdit}
                        disabled={saving || deleting}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionButtonText}>
                          {language === "en" ? "Cancel" : "रद्द करा"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── View Mode inside Modal ─────────────────── */
                  <View style={styles.detailGrid}>
                    <DetailItem
                      icon="home-outline"
                      label={language === "en" ? "Room Owner" : "रूम मालक"}
                      value={roomOwner}
                    />
                    <DetailItem
                      icon="restaurant-outline"
                      label={language === "en" ? "Meal Plan" : "जेवण योजना"}
                      value={displayMealPlanMr(
                        language,
                        member?.mealPlan || "Lunch",
                        member?.mealPlanMr
                      )}
                    />
                    <DetailItem
                      icon="call-outline"
                      label={language === "en" ? "Phone" : "फोन"}
                      value={member?.phone || "-"}
                    />
                    <DetailItem
                      icon="calendar-outline"
                      label={language === "en" ? "Joining Date" : "जॉइनिंग तारीख"}
                      value={formatDate(member?.joiningDate)}
                    />
                    <DetailItem
                      icon="mail-outline"
                      label={language === "en" ? "Email" : "ईमेल"}
                      value={member?.email || member?.userId?.email || "-"}
                    />
                    <DetailItem
                      icon="pricetag-outline"
                      label={language === "en" ? "Monthly Charge" : "मासिक शुल्क"}
                      value={formatCurrency(member?.mealPlanPrice)}
                    />
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Activity Calendar ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.calendarHeader}>
            <View>
              <View style={styles.cardTitleRow}>
                <Ionicons name="calendar-outline" size={18} color="#6366F1" />
                <Text style={styles.cardTitle}>
                  {language === "en" ? "Activity Calendar" : "क्रियाकलाप कॅलेंडर"}
                </Text>
              </View>
              <Text style={styles.monthDueText}>
                {language === "en" ? "Monthly Due: " : "मासिक बाकी: "}
                <Text
                  style={
                    monthlyDue > 0 ? styles.dueAmountRed : styles.dueAmountGreen
                  }
                >
                  {formatCurrency(monthlyDue)}
                </Text>
              </Text>
            </View>

            <View style={styles.monthNavGroup}>
              {/* Jump to Today button */}
              {!isCurrentMonth && (
                <TouchableOpacity
                  style={styles.todayButton}
                  onPress={() => setMonthDate(maxMonth || new Date())}
                  accessibilityRole="button"
                  accessibilityLabel={
                    language === "en" ? "Go to current month" : "सध्याच्या महिन्यावर जा"
                  }
                >
                  <Text style={styles.todayButtonText}>
                    {language === "en" ? "Today" : "आज"}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.monthNav}>
                <TouchableOpacity
                  style={[
                    styles.monthButton,
                    !canGoPrev && styles.monthButtonDisabled,
                  ]}
                  onPress={() =>
                    setMonthDate((prev) =>
                      shiftMemberMonthDate(prev, -1, minMonth, maxMonth)
                    )
                  }
                  disabled={!canGoPrev}
                  accessibilityRole="button"
                  accessibilityLabel={
                    language === "en" ? "Previous month" : "मागील महिना"
                  }
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={canGoPrev ? "#6366F1" : "#9CA3AF"}
                  />
                </TouchableOpacity>
                <Text style={styles.monthText}>{monthLabel}</Text>
                <TouchableOpacity
                  style={[
                    styles.monthButton,
                    !canGoNext && styles.monthButtonDisabled,
                  ]}
                  onPress={() =>
                    setMonthDate((prev) =>
                      shiftMemberMonthDate(prev, 1, minMonth, maxMonth)
                    )
                  }
                  disabled={!canGoNext}
                  accessibilityRole="button"
                  accessibilityLabel={
                    language === "en" ? "Next month" : "पुढील महिना"
                  }
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={canGoNext ? "#6366F1" : "#9CA3AF"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {weekdays.map((d, idx) => (
              <Text
                key={`${d}-${idx}`}
                style={[
                  styles.weekText,
                  (idx === 0 || idx === 6) && styles.weekTextWeekend,
                ]}
              >
                {d}
              </Text>
            ))}
          </View>

          {calendarLoading ? (
            <View style={styles.calendarLoading}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : (
            <View style={styles.grid}>
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return (
                    <View
                      key={`empty-${idx}`}
                      style={[styles.cell, { width: cellSize, height: cellSize }]}
                    />
                  );
                }
                const dateKey = formatDate(cell, "");
                const isLeave = leaveDateSet.has(dateKey);
                const isFuture = cell > new Date();
                const joinDate =
                  member?.joiningDate &&
                  !Number.isNaN(new Date(member.joiningDate).getTime())
                    ? toDateOnlyLocal(new Date(member.joiningDate))
                    : null;
                const isBeforeJoining =
                  joinDate &&
                  toDateOnlyLocal(cell).getTime() < joinDate.getTime();
                const isUpdatingCell = calendarDayUpdatingKeys.includes(dateKey);
                const isToday = dateKey === todayKey;
                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize },
                      isLeave ? styles.inactiveDayCell : styles.activeDayCell,
                      isFuture && styles.futureDayCell,
                      isBeforeJoining && styles.beforeJoiningCell,
                      isUpdatingCell && styles.dayUpdatingCell,
                      isToday && styles.todayCell,
                    ]}
                    disabled={
                      !isEditing || isFuture || isBeforeJoining || isUpdatingCell
                    }
                    onPress={() => onToggleCalendarDay(dateKey, !isLeave)}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.getDate()} ${
                      isLeave
                        ? language === "en" ? "leave" : "रजा"
                        : language === "en" ? "active" : "सक्रिय"
                    }`}
                    accessibilityState={{ selected: isLeave }}
                  >
                    {isUpdatingCell ? (
                      <ActivityIndicator
                        size="small"
                        color={isLeave ? "#991B1B" : "#166534"}
                        style={{ width: 14, height: 14 }}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.cellText,
                          isLeave ? styles.inactiveDayText : styles.activeDayText,
                          isFuture && styles.futureDayText,
                          isBeforeJoining && styles.beforeJoiningText,
                          isToday && styles.todayCellText,
                        ]}
                      >
                        {cell.getDate()}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Calendar summary bar */}
          <View style={styles.calendarSummary}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: "#16A34A" }]} />
              <Text style={styles.summaryText}>
                {language === "en"
                  ? `Active: ${calendarStats.active}`
                  : `सक्रिय: ${calendarStats.active}`}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: "#DC2626" }]} />
              <Text style={styles.summaryText}>
                {language === "en"
                  ? `Leave: ${calendarStats.leave}`
                  : `रजा: ${calendarStats.leave}`}
              </Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
            <Text style={styles.legend}>
              {language === "en"
                ? isEditing
                  ? "Edit mode: tap a day to toggle leave."
                  : "Enable edit mode to toggle leave days."
                : isEditing
                ? "एडिट मोड: दिवसावर टॅप करून रजा बदला."
                : "रजा बदलण्यासाठी एडिट मोड चालू करा."}
            </Text>
          </View>
        </View>

        {/* ── Danger Zone ────────────────────────────────────────────────── */}
        {!isEditing && (
          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={styles.dangerTitle}>
                {language === "en" ? "Danger Zone" : "धोक्याचे क्षेत्र"}
              </Text>
            </View>
            <Text style={styles.dangerDesc}>
              {language === "en"
                ? "Deleting a member is permanent and cannot be undone. All data associated with this member will be removed."
                : "सदस्य हटवणे कायमचे आहे आणि ते पूर्ववत करता येत नाही. या सदस्याशी संबंधित सर्व डेटा काढला जाईल."}
            </Text>
            <TouchableOpacity
              style={[styles.deleteButton, deleting && styles.actionDisabled]}
              onPress={confirmDelete}
              disabled={deleting || saving}
              accessibilityRole="button"
              accessibilityLabel={
                language === "en" ? "Delete member" : "सदस्य हटवा"
              }
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.deleteButtonText}>
                    {language === "en" ? "Delete Member" : "सदस्य हटवा"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Toast Notification ─────────────────────────────────────────── */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === "success" ? styles.toastSuccess : styles.toastError,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [60, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons
            name={toast.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },
  headerActionButtonActive: {
    backgroundColor: "#FEF2F2",
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 8,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Profile Card ──────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    gap: 12,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  pulseWrapper: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#22C55E",
  },
  dotInactive: {
    backgroundColor: "#EF4444",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: "#DCFCE7",
  },
  badgeInactive: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeActiveText: {
    color: "#166534",
  },
  badgeInactiveText: {
    color: "#991B1B",
  },
  membershipDuration: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  dueChip: {
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    minWidth: 82,
    borderWidth: 1,
  },
  dueChipRed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  dueChipGreen: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  dueChipLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dueChipAmount: {
    fontSize: 13,
    fontWeight: "800",
  },
  dueAmountRed: {
    color: "#DC2626",
  },
  dueAmountGreen: {
    color: "#16A34A",
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  // ── Detail Grid ───────────────────────────────────────────────────────────
  detailGrid: {
    gap: 0,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  detailItemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  detailItemContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailItemLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  detailItemValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },

  // ── Edit Form ─────────────────────────────────────────────────────────────
  editWrap: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 4,
    fontWeight: "600",
  },
  readonlyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  readonlyInputText: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },

  // ── Toggle Chips ──────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  toggleChipActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  toggleChipGreen: {
    borderColor: "#16A34A",
    backgroundColor: "#DCFCE7",
  },
  toggleChipRed: {
    borderColor: "#DC2626",
    backgroundColor: "#FEE2E2",
  },
  toggleChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleChipTextActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  toggleChipTextGreen: {
    color: "#166534",
    fontWeight: "700",
  },
  toggleChipTextRed: {
    color: "#991B1B",
    fontWeight: "700",
  },

  // ── Action Buttons ────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#6366F1",
  },
  cancelButton: {
    backgroundColor: "#6B7280",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  actionDisabled: {
    opacity: 0.6,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  calendarHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthNavGroup: {
    alignItems: "flex-end",
    gap: 6,
  },
  todayButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  todayButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366F1",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonDisabled: {
    backgroundColor: "#F3F4F6",
  },
  monthText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  monthDueText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
    marginTop: 2,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "700",
  },
  weekTextWeekend: {
    color: "#F87171",
  },
  calendarLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    margin: 1,
  },
  activeDayCell: {
    backgroundColor: "#DCFCE7",
  },
  inactiveDayCell: {
    backgroundColor: "#FEE2E2",
  },
  futureDayCell: {
    backgroundColor: "#F9FAFB",
  },
  beforeJoiningCell: {
    backgroundColor: "#F3F4F6",
  },
  dayUpdatingCell: {
    opacity: 0.6,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  cellText: {
    fontSize: 12,
    color: "#374151",
  },
  activeDayText: {
    color: "#166534",
    fontWeight: "700",
  },
  inactiveDayText: {
    color: "#991B1B",
    fontWeight: "700",
  },
  futureDayText: {
    color: "#9CA3AF",
    fontWeight: "500",
  },
  beforeJoiningText: {
    color: "#D1D5DB",
    fontWeight: "600",
  },
  todayCellText: {
    color: "#4F46E5",
    fontWeight: "800",
  },

  // ── Calendar Summary ──────────────────────────────────────────────────────
  calendarSummary: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },

  // ── Legend ────────────────────────────────────────────────────────────────
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  legend: {
    fontSize: 11,
    color: "#9CA3AF",
    flex: 1,
    lineHeight: 16,
  },

  // ── Danger Zone ───────────────────────────────────────────────────────────
  dangerZone: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  dangerDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  deleteButton: {
    borderRadius: 10,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: "#16A34A",
  },
  toastError: {
    backgroundColor: "#DC2626",
  },
  toastText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // ── Tap Hint ─────────────────────────────────────────────────────
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
  },
  tapHintText: {
    fontSize: 11,
    color: "#6366F1",
    fontWeight: "600",
  },

  // ── Modal ─────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarInitials: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    maxWidth: 160,
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 1,
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  modalEditBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flexShrink: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
