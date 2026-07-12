import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pencil, User, X } from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { displayMealPlanMr, displayStatusMr } from "@/lib/memberLabelsMr";
import {
  dateToYearMonth,
  getMaxSelectableYearMonth,
  getPolicyMinYearMonth,
  isBeforeJuneYearMonth,
  shiftMemberMonthDate,
  snapToJuneYearMonth,
  yearMonthToDate,
} from "@/lib/monthNavigation";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

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

const isValidMonthDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

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

export default function MemberDetails() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calendarDayUpdatingKeys, setCalendarDayUpdatingKeys] = useState([]);
  const [monthlyDue, setMonthlyDue] = useState(0);
  const [totalMonthlyDue, setTotalMonthlyDue] = useState(0);
  const dueRefreshTimerRef = useRef(null);
  const latestMonthlyDueReqRef = useRef(0);
  const latestTotalDueReqRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchMemberDetails = useCallback(async () => {
    if (!memberIdValue) {
      setLoading(false);
      Alert.alert("Error", language === "en" ? "Member not found" : "सदस्य सापडला नाही");
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/members/${memberIdValue}`);
      const payload = res.data || null;
      setMember(payload);
      setForm({
        name: String(payload?.name || "").trim(),
        roomOwnerName: String(payload?.roomOwnerName || payload?.roomNumber || "").trim(),
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
    } catch {
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
    } catch {
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
    fetchMemberDetails();
  }, [fetchMemberDetails]);

  useEffect(() => {
    if (memberIdValue) {
      fetchLeaveCalendar();
      fetchMonthlyDue();
      fetchTotalMonthlyDue();
    }
  }, [memberIdValue, fetchLeaveCalendar, fetchMonthlyDue, fetchTotalMonthlyDue]);

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

  useEffect(() => {
    return () => {
      if (dueRefreshTimerRef.current) clearTimeout(dueRefreshTimerRef.current);
    };
  }, []);

  const title =
    language === "mr"
      ? member?.nameMr || member?.name || "सदस्य तपशील"
      : member?.name || member?.nameMr || "Member Details";
  const roomOwner =
    language === "mr"
      ? member?.roomOwnerNameMr || member?.roomOwnerName || member?.roomNumber || "-"
      : member?.roomOwnerName || member?.roomOwnerNameMr || member?.roomNumber || "-";
  const monthLabel = monthDate.toLocaleDateString(language === "mr" ? "mr-IN" : "en-IN", {
    month: "long",
    year: "numeric",
  });
  const canGoPrev = !minMonth || monthDate > minMonth;
  const canGoNext = !maxMonth || monthDate < maxMonth;

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    const payload = {
      name: String(form.name || "").trim(),
      roomOwnerName: String(form.roomOwnerName || "").trim(),
      phone: String(form.phone || "").trim(),
      email: String(form.email || "").trim(),
      joiningDate: String(form.joiningDate || "").trim(),
      status: form.status === "Inactive" ? "Inactive" : "Active",
      mealPlan: ["Lunch", "Dinner", "Both"].includes(form.mealPlan) ? form.mealPlan : "Lunch",
    };
    if (!payload.name || !payload.roomOwnerName) {
      Alert.alert(
        language === "en" ? "Validation error" : "तपासणी त्रुटी",
        language === "en"
          ? "Name and room owner are required."
          : "नाव आणि रूम मालक आवश्यक आहेत."
      );
      return;
    }
    try {
      setSaving(true);
      await api.put(`/api/members/${memberIdValue}`, payload);
      setIsEditing(false);
      await Promise.all([
        fetchMemberDetails(),
        fetchLeaveCalendar(),
        fetchMonthlyDue(),
        fetchTotalMonthlyDue(),
      ]);
      Alert.alert(
        language === "en" ? "Updated" : "अपडेट झाले",
        language === "en"
          ? "Member details updated successfully."
          : "सदस्य तपशील यशस्वीरित्या अपडेट झाले."
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
    setForm({
      name: String(member?.name || "").trim(),
      roomOwnerName: String(member?.roomOwnerName || member?.roomNumber || "").trim(),
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
              Alert.alert(
                language === "en" ? "Deleted" : "हटवले",
                language === "en"
                  ? "Member deleted successfully."
                  : "सदस्य यशस्वीरित्या हटवला."
              );
              navigate("/members", { replace: true });
            } catch (err) {
              Alert.alert(
                language === "en" ? "Error" : "त्रुटी",
                err?.response?.data?.message ||
                  (language === "en" ? "Failed to delete member." : "सदस्य हटवता आला नाही.")
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const onToggleCalendarDay = useCallback(
    async (dateKey, nextInactive) => {
      if (!dateKey || calendarDayUpdatingKeys.includes(dateKey)) return;
      const previous = leaveDates;
      setLeaveDates((prev) => {
        const set = new Set(prev || []);
        if (nextInactive) set.add(dateKey);
        else set.delete(dateKey);
        return Array.from(set).sort();
      });
      try {
        setCalendarDayUpdatingKeys((keys) => Array.from(new Set([...(keys || []), dateKey])));
        const res = await api.put(
          `/api/leave/member/${memberIdValue}/calendar-day`,
          { date: dateKey, inactive: nextInactive },
          { params: { fast: 1 } }
        );
        if (Number.isFinite(Number(res?.data?.due))) setMonthlyDue(Number(res.data.due));
        if (Number.isFinite(Number(res?.data?.totalDue)))
          setTotalMonthlyDue(Number(res.data.totalDue));
        if (res?.data?.memberStatus) {
          const nextMemberStatus =
            res.data.memberStatus === "Inactive" ? "Inactive" : "Active";
          const nextMemberStatusMr = String(res?.data?.memberStatusMr || "").trim();
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
        setCalendarDayUpdatingKeys((keys) => (keys || []).filter((k) => k !== dateKey));
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
  }, [memberIdValue, fetchMemberDetails, fetchLeaveCalendar, fetchMonthlyDue, fetchTotalMonthlyDue]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader
          title={language === "en" ? "Member Profile" : "सदस्य प्रोफाइल"}
          backTo="/members"
        />
        <button
          type="button"
          className="rounded-full bg-slate-100 p-2.5 text-slate-700 hover:bg-slate-200"
          onClick={() => (isEditing ? onCancelEdit() : setIsEditing(true))}
          disabled={saving || deleting}
          aria-label={isEditing ? "Cancel edit" : "Edit"}
        >
          {isEditing ? <X className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
        </button>
      </div>

      <button
        type="button"
        className="btn-secondary mb-4 text-sm"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>

      <div className="card-panel mb-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
          <User className="h-6 w-6 text-slate-800" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
              member?.status === "Inactive"
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {displayStatusMr(language, member?.status || "Active", member?.statusMr)}
          </span>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {language === "en" ? "Total Due: " : "एकूण बाकी: "}
            {formatCurrency(totalMonthlyDue)}
          </p>
        </div>
      </div>

      <div className="card-panel mb-4">
        <h3 className="mb-3 font-bold text-slate-900">
          {language === "en" ? "Details" : "तपशील"}
        </h3>
        {isEditing ? (
          <div className="space-y-3">
            <input
              className="input-field"
              placeholder={language === "en" ? "Member name" : "सदस्य नाव"}
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
            />
            <input
              className="input-field"
              placeholder={language === "en" ? "Room owner name" : "रूम मालक नाव"}
              value={form.roomOwnerName}
              onChange={(e) => updateForm("roomOwnerName", e.target.value)}
            />
            <input
              className="input-field"
              placeholder={language === "en" ? "Phone" : "फोन"}
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
            />
            <input
              className="input-field"
              placeholder={language === "en" ? "Email" : "ईमेल"}
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
            />
            <input
              className="input-field bg-slate-100 text-slate-500"
              value={form.joiningDate}
              readOnly
            />
            <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
              <span className="rounded-lg bg-slate-100 px-3 py-2">
                {(language === "en" ? "Meal Plan: " : "जेवण योजना: ") + form.mealPlan}
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-2">
                {(language === "en" ? "Status: " : "स्थिती: ") + form.status}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1 bg-green-600"
                disabled={saving || deleting}
                onClick={onSave}
              >
                {saving
                  ? language === "en"
                    ? "Saving..."
                    : "सेव्ह होत आहे..."
                  : language === "en"
                    ? "Save"
                    : "सेव्ह करा"}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={onCancelEdit}>
                {language === "en" ? "Cancel" : "रद्द करा"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700">
              {language === "en" ? "Room Owner" : "रूम मालक"}: {roomOwner}
              <span className="mx-2 text-slate-300">|</span>
              {language === "en" ? "Meal Plan" : "जेवण योजना"}:{" "}
              {displayMealPlanMr(language, member?.mealPlan || "Lunch", member?.mealPlanMr)}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {language === "en" ? "Phone" : "फोन"}: {member?.phone || "-"}
              <span className="mx-2 text-slate-300">|</span>
              {language === "en" ? "Joining Date" : "जॉइनिंग तारीख"}:{" "}
              {formatDate(member?.joiningDate)}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {language === "en" ? "Email" : "ईमेल"}: {member?.email || member?.userId?.email || "-"}
              <span className="mx-2 text-slate-300">|</span>
              {language === "en" ? "mealAmt" : "चार्ज केलेली रक्कम"}:{" "}
              {formatCurrency(member?.mealPlanPrice)}
            </p>
            <button
              type="button"
              className="btn-danger mt-4 w-full"
              disabled={deleting || saving}
              onClick={confirmDelete}
            >
              {deleting
                ? language === "en"
                  ? "Deleting..."
                  : "हटवत आहे..."
                : language === "en"
                  ? "Delete Member"
                  : "सदस्य हटवा"}
            </button>
          </>
        )}
      </div>

      <div className="card-panel">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">
              {language === "en" ? "Activity Calendar" : "क्रियाकलाप कॅलेंडर"}
            </h3>
            <p className="text-sm font-semibold text-slate-600">
              {language === "en" ? "Monthly Due: " : "मासिक बाकी: "}
              {formatCurrency(monthlyDue)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-100 p-1.5 disabled:opacity-40"
              disabled={!canGoPrev}
              onClick={() =>
                setMonthDate((prev) => shiftMemberMonthDate(prev, -1, minMonth, maxMonth))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-900">{monthLabel}</span>
            <button
              type="button"
              className="rounded-full bg-slate-100 p-1.5 disabled:opacity-40"
              disabled={!canGoNext}
              onClick={() =>
                setMonthDate((prev) => shiftMemberMonthDate(prev, 1, minMonth, maxMonth))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
            <span key={`${d}-${idx}`}>{d}</span>
          ))}
        </div>

        {calendarLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              const dateKey = formatDate(cell, "");
              const isLeave = leaveDateSet.has(dateKey);
              const isFuture = cell > new Date();
              const joinDate =
                member?.joiningDate && !Number.isNaN(new Date(member.joiningDate).getTime())
                  ? toDateOnlyLocal(new Date(member.joiningDate))
                  : null;
              const isBeforeJoining =
                joinDate && toDateOnlyLocal(cell).getTime() < joinDate.getTime();
              const isUpdatingCell = calendarDayUpdatingKeys.includes(dateKey);
              const disabled = !isEditing || isFuture || isBeforeJoining || isUpdatingCell;

              let cellClass =
                "flex aspect-square items-center justify-center text-xs font-bold transition ";
              if (isBeforeJoining) cellClass += "bg-slate-100 text-slate-400 ";
              else if (isFuture) cellClass += "bg-slate-50 text-slate-400 ";
              else if (isLeave) cellClass += "bg-red-100 text-red-800 ";
              else cellClass += "bg-green-100 text-green-800 ";
              if (isUpdatingCell) cellClass += "opacity-60 ";
              if (!disabled && isEditing) cellClass += "cursor-pointer hover:ring-2 hover:ring-slate-400 ";

              return (
                <button
                  key={dateKey}
                  type="button"
                  className={cellClass}
                  disabled={disabled}
                  onClick={() => onToggleCalendarDay(dateKey, !isLeave)}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          {language === "en"
            ? isEditing
              ? "Edit mode: click a day to toggle leave. Green = active, Red = leave."
              : "Green = active day, Red = inactive leave day."
            : isEditing
              ? "एडिट मोड: दिवसावर क्लिक करून रजा बदला. हिरवा = सक्रिय, लाल = रजा."
              : "हिरवा = सक्रिय दिवस, लाल = निष्क्रिय रजा दिवस."}
        </p>
      </div>
    </div>
  );
}
