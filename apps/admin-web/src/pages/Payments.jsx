import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  CreditCard,
  History,
  Loader2,
  Phone,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { getMonthLabel } from "@/lib/monthLabels";
import { fetchMemberDirectory } from "@/lib/memberDirectory";
import {
  clampYearMonthToSelectableWindow,
  combineMinYearMonth,
  getCurrentYearMonth,
  getMaxSelectableYearMonth,
  stepNextYearMonth,
  stepPrevYearMonth,
} from "@/lib/monthNavigation";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import MonthNavigator from "@/components/ui/MonthNavigator";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const formatDisplayDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const toYearMonthValue = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getRemainingAmountFromBill = (bill) => {
  if (!bill || typeof bill !== "object") return null;
  const remaining = toFiniteNumber(
    bill.remainingAmount ?? bill.remainingForMonth
  );
  if (remaining != null) return Math.max(0, remaining);
  const due = toFiniteNumber(bill.dueAmount ?? bill.due);
  const paid = toFiniteNumber(bill.paidAmount ?? bill.collected);
  if (due == null && paid == null) return null;
  return Math.max(
    0,
    Math.max(0, Number(due || 0)) - Math.max(0, Number(paid || 0))
  );
};

export default function Payments() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [members, setMembers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [totalDue, setTotalDue] = useState(0);
  const [dueMonths, setDueMonths] = useState([]);
  const [selectedDueMonth, setSelectedDueMonth] = useState(null);
  const [selectedMonthDue, setSelectedMonthDue] = useState(0);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [upiTransactionId, setUpiTransactionId] = useState("");
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState("");
  const submitLockRef = useRef(false);
  const [monthlySummary, setMonthlySummary] = useState({
    collected: 0,
    pending: 0,
    membersPaid: 0,
    remainingMembers: 0,
  });
  const [monthMemberBills, setMonthMemberBills] = useState([]);
  const [monthMemberBillsLoading, setMonthMemberBillsLoading] = useState(false);
  const [memberListSearch, setMemberListSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const selectedMonthParam = useMemo(() => {
    const year = Math.floor(selectedMonth / 12);
    const monthIndex = selectedMonth % 12;
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  }, [selectedMonth]);

  const getYearMonth = (date) =>
    date ? date.getFullYear() * 12 + date.getMonth() : null;

  const filteredMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const en = String(m?.name || "").toLowerCase();
      const mr = String(m?.nameMr || "").toLowerCase();
      return en.includes(q) || mr.includes(q);
    });
  }, [members, memberSearchQuery]);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/payments");
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalized = raw.map((p) => ({
        ...p,
        studentId: p?.memberId?._id || p?.memberId || p?.studentId,
        studentName: p?.memberName || p?.memberId?.name || p?.studentName || "",
        studentNameMr:
          p?.memberNameMr ||
          p?.memberId?.nameMr ||
          p?.studentNameMr ||
          p?.memberId?.name ||
          "",
      }));
      setPayments(normalized);
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load payments"
      );
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const rows = await fetchMemberDirectory(api);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load members"
      );
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchMembers();
  }, [fetchPayments, fetchMembers]);

  const fetchMonthMemberBills = useCallback(async () => {
    try {
      setMonthMemberBillsLoading(true);
      const res = await api.get("/api/members/due-month", {
        params: { month: selectedMonthParam },
      });
      const rows = Array.isArray(res?.data?.members) ? res.data.members : [];
      setMonthMemberBills(rows);
      const totals = rows.reduce(
        (acc, row) => {
          const remaining = getRemainingAmountFromBill(row);
          const collected = Number(row?.paidAmount ?? row?.collected ?? 0);
          const totalBill = Math.max(
            0,
            Number(
              row?.totalBill ??
                (remaining == null ? 0 : remaining + Math.max(0, collected))
            )
          );
          const finalDue = Math.max(0, Number(remaining || 0));
          acc.collected += Math.max(0, collected);
          acc.pending += finalDue;
          if (totalBill > 0 && finalDue <= 0) acc.membersPaid += 1;
          if (totalBill > 0 && finalDue > 0) acc.remainingMembers += 1;
          return acc;
        },
        { collected: 0, pending: 0, membersPaid: 0, remainingMembers: 0 }
      );
      setMonthlySummary(totals);
    } catch {
      setMonthMemberBills([]);
      setMonthlySummary({
        collected: 0,
        pending: 0,
        membersPaid: 0,
        remainingMembers: 0,
      });
    } finally {
      setMonthMemberBillsLoading(false);
    }
  }, [selectedMonthParam]);

  useEffect(() => {
    fetchMonthMemberBills();
  }, [fetchMonthMemberBills]);

  const earliestPaymentMonth = useMemo(() => {
    let min = null;
    for (const p of payments) {
      const d = p.month ? new Date(p.month) : p.date ? new Date(p.date) : null;
      if (!d) continue;
      const ym = getYearMonth(d);
      if (!Number.isNaN(ym) && (min === null || ym < min)) {
        min = ym;
      }
    }
    return min;
  }, [payments]);

  const earliestSelectableMonth = useMemo(() => {
    const current = getCurrentYearMonth(0);
    const twoYearsBack = getCurrentYearMonth(-24);
    const dataEarliest =
      earliestPaymentMonth == null
        ? twoYearsBack
        : Math.min(earliestPaymentMonth, current);
    return combineMinYearMonth(dataEarliest);
  }, [earliestPaymentMonth]);

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(
        m,
        earliestSelectableMonth,
        getMaxSelectableYearMonth()
      )
    );
  }, [earliestSelectableMonth]);

  const billByMemberId = useMemo(() => {
    const map = new Map();
    for (const row of monthMemberBills || []) {
      const id = row?.memberId || row?._id;
      if (!id) continue;
      map.set(String(id), row);
    }
    return map;
  }, [monthMemberBills]);

  const monthMemberStatusRows = useMemo(() => {
    const rows = (members || []).map((m) => {
      const id = String(m?._id || "");
      const bill = billByMemberId.get(id);
      const due = getRemainingAmountFromBill(bill);
      const monthlyStatus =
        bill && due != null ? (due <= 0 ? "Paid" : "Pending") : "N/A";
      return {
        memberId: id,
        name: m?.name || "",
        nameMr: m?.nameMr || m?.name || "",
        phone: m?.phone || "",
        remainingAmount: due,
        monthlyStatus,
      };
    });
    const collator = new Intl.Collator("en", { sensitivity: "base" });
    rows.sort((a, b) =>
      collator.compare(
        String(language === "mr" ? a.nameMr || a.name : a.name || a.nameMr),
        String(language === "mr" ? b.nameMr || b.name : b.name || b.nameMr)
      )
    );
    return rows;
  }, [members, billByMemberId, language]);

  const filteredMonthMemberStatusRows = useMemo(() => {
    const q = String(memberListSearch || "").trim().toLowerCase();
    if (!q) return monthMemberStatusRows;
    return monthMemberStatusRows.filter((row) => {
      const nameEn = String(row?.name || "").toLowerCase();
      const nameMr = String(row?.nameMr || "").toLowerCase();
      const phone = String(row?.phone || "").toLowerCase();
      return nameEn.includes(q) || nameMr.includes(q) || phone.includes(q);
    });
  }, [monthMemberStatusRows, memberListSearch]);

  const maxYm = getMaxSelectableYearMonth();

  const goRemaining = () => {
    const month = encodeURIComponent(selectedMonthParam);
    navigate(`/payments/remaining?month=${month}`, {
      state: { month: selectedMonthParam },
    });
  };

  const goPaid = () => {
    const month = encodeURIComponent(selectedMonthParam);
    navigate(`/payments/paid?month=${month}`, {
      state: { month: selectedMonthParam },
    });
  };

  const onCallPress = (row) => {
    const phone = String(row?.phone || "").trim();
    if (!phone) {
      Alert.alert(
        "Info",
        language === "en" ? "Phone not available" : "फोन उपलब्ध नाही"
      );
      return;
    }
    window.open(`tel:${phone}`, "_self");
  };

  const handleDeletePayment = (payment) => {
    if (!payment?._id) return;
    Alert.alert(
      language === "en" ? "Delete payment?" : "पेमेंट हटवायचे?",
      language === "en"
        ? "This payment entry will be removed and collected amount will be recalculated."
        : "ही पेमेंट नोंद हटवली जाईल आणि जमा रक्कम पुन्हा मोजली जाईल.",
      [
        {
          text: language === "en" ? "Cancel" : "रद्द करा",
          style: "cancel",
        },
        {
          text: language === "en" ? "Delete" : "हटवा",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingPaymentId(String(payment._id));
              await api.delete(`/api/payments/${payment._id}`);
              await Promise.all([fetchPayments(), fetchMonthMemberBills()]);
            } catch (err) {
              Alert.alert(
                language === "en" ? "Error" : "त्रुटी",
                err?.response?.data?.message ||
                  (language === "en"
                    ? "Failed to delete payment"
                    : "पेमेंट हटवता आले नाही")
              );
            } finally {
              setDeletingPaymentId("");
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setMemberSearchQuery("");
    setSelectedMember(null);
    setTotalDue(0);
    setDueMonths([]);
    setSelectedDueMonth(null);
    setSelectedMonthDue(0);
    setPaidAmount("");
    setPaymentMethod("Cash");
    setUpiTransactionId("");
    setShowMemberPicker(false);
    setShowMonthPicker(false);
    setShowModePicker(false);
    setSubmitting(false);
    submitLockRef.current = false;
  };

  const openRecordModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const closeRecordModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const loadMemberDueInfo = useCallback(async (memberId) => {
    try {
      const [totalRes, monthsRes] = await Promise.all([
        api.get(`/api/members/${memberId}/monthly-due-total`),
        api.get(`/api/members/${memberId}/monthly-due-months`),
      ]);
      const months = Array.isArray(monthsRes?.data?.months)
        ? monthsRes.data.months
        : [];
      setTotalDue(Number(totalRes?.data?.totalDue || 0));
      setDueMonths(months);
      if (months.length > 0) {
        const firstMonth = months[0];
        setSelectedDueMonth(toYearMonthValue(firstMonth.month));
        setSelectedMonthDue(Number(firstMonth?.due || 0));
      } else {
        setSelectedDueMonth(null);
        setSelectedMonthDue(0);
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load due details"
      );
      setTotalDue(0);
      setDueMonths([]);
      setSelectedDueMonth(null);
      setSelectedMonthDue(0);
    }
  }, []);

  const selectMember = async (member) => {
    setSelectedMember(member);
    setShowMemberPicker(false);
    await loadMemberDueInfo(member._id);
  };

  const selectDueMonth = async (monthValue) => {
    setSelectedDueMonth(monthValue);
    setShowMonthPicker(false);
    if (!selectedMember?._id || !monthValue) return;
    try {
      const res = await api.get(
        `/api/members/${selectedMember._id}/monthly-due`,
        { params: { month: monthValue } }
      );
      setSelectedMonthDue(Number(res?.data?.due || 0));
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load month due"
      );
      setSelectedMonthDue(0);
    }
  };

  const paidAmountNumber = Number(paidAmount) || 0;
  const selectedMonthDueNumber = Number(selectedMonthDue) || 0;
  const dueAfterPayment = Math.max(
    0,
    Number(selectedMonthDue || 0) - paidAmountNumber
  );
  const isOverpay =
    String(paidAmount || "").trim().length > 0 &&
    paidAmountNumber > selectedMonthDueNumber;

  const handleMarkPayment = async () => {
    if (submitting || submitLockRef.current) return;
    submitLockRef.current = true;
    if (!selectedMember?._id) {
      Alert.alert("Validation", "Please select member");
      submitLockRef.current = false;
      return;
    }
    if (!selectedDueMonth) {
      Alert.alert("Validation", "Please select due month");
      submitLockRef.current = false;
      return;
    }
    if (!Number.isFinite(paidAmountNumber) || paidAmountNumber <= 0) {
      Alert.alert("Validation", "Please enter valid paid amount");
      submitLockRef.current = false;
      return;
    }
    if (paidAmountNumber > selectedMonthDueNumber) {
      Alert.alert(
        "Validation",
        `Paid amount cannot be greater than due amount (${formatCurrency(
          selectedMonthDueNumber
        )})`
      );
      submitLockRef.current = false;
      return;
    }
    if (paymentMethod === "UPI" && !String(upiTransactionId || "").trim()) {
      Alert.alert("Validation", "UPI transaction ID is required");
      submitLockRef.current = false;
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/api/payments", {
        memberId: selectedMember._id,
        month: selectedDueMonth,
        paidAmount: paidAmountNumber,
        paymentMethod,
        upiTransactionId:
          paymentMethod === "UPI" ? String(upiTransactionId).trim() : "",
      });
      const paidMonthDate = new Date(selectedDueMonth);
      const paidMonthValue = !Number.isNaN(paidMonthDate.getTime())
        ? paidMonthDate.getFullYear() * 12 + paidMonthDate.getMonth()
        : null;
      if (!Number.isNaN(paidMonthDate.getTime())) {
        setSelectedMonth(
          paidMonthDate.getFullYear() * 12 + paidMonthDate.getMonth()
        );
      }
      Alert.alert("Success", "Payment marked successfully");
      const shouldRefreshCurrentMonth =
        paidMonthValue == null || paidMonthValue === selectedMonth;
      await Promise.all([
        fetchPayments(),
        loadMemberDueInfo(selectedMember._id),
        shouldRefreshCurrentMonth ? fetchMonthMemberBills() : Promise.resolve(),
      ]);
      closeRecordModal();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to mark payment"
      );
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchPayments(),
        fetchMembers(),
        fetchMonthMemberBills(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPayments, fetchMembers, fetchMonthMemberBills]);

  const pageTitle =
    language === "en" ? "Member Payments" : "सदस्य पेमेंट्स";
  const monthLabel = getMonthLabel(selectedMonth, language);

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={pageTitle} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-secondary text-sm"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setHistoryModalVisible(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            aria-label="Payment history"
          >
            <History className="h-4 w-4" />
            {language === "en" ? "History" : "इतिहास"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={openRecordModal}
        className="btn-primary mb-4 flex w-full items-center justify-center gap-2 sm:w-auto"
      >
        <Plus className="h-5 w-5" />
        {language === "en" ? "Record Payment" : "पेमेंट नोंदवा"}
      </button>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs font-medium text-slate-500">
            {language === "en"
              ? `Collected (${monthLabel})`
              : `प्राप्त (${monthLabel})`}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatCurrency(monthlySummary.collected)}
          </p>
        </div>
        <button
          type="button"
          onClick={goRemaining}
          className="card text-left transition hover:border-brand-300 hover:shadow-elevated"
        >
          <p className="text-xs font-medium text-slate-500">
            {language === "en"
              ? `Pending (${monthLabel})`
              : `बाकी (${monthLabel})`}
          </p>
          <p className="mt-1 text-xl font-bold text-red-600">
            {formatCurrency(monthlySummary.pending)}
          </p>
        </button>
        <button
          type="button"
          onClick={goPaid}
          className="card text-left transition hover:border-brand-300 hover:shadow-elevated"
        >
          <p className="text-xs font-medium text-slate-500">
            {language === "en"
              ? `Members Paid (${monthLabel})`
              : `पेमेंट पूर्ण (${monthLabel})`}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {monthlySummary.membersPaid}
          </p>
        </button>
        <button
          type="button"
          onClick={goRemaining}
          className="card text-left transition hover:border-brand-300 hover:shadow-elevated"
        >
          <p className="text-xs font-medium text-slate-500">
            {language === "en"
              ? `Remaining Members (${monthLabel})`
              : `बाकी सदस्य (${monthLabel})`}
          </p>
          <p className="mt-1 text-xl font-bold text-red-600">
            {monthlySummary.remainingMembers}
          </p>
        </button>
      </div>

      <div className="mb-4">
        <MonthNavigator
          yearMonth={selectedMonth}
          language={language}
          canPrev={selectedMonth > earliestSelectableMonth}
          canNext={selectedMonth < maxYm}
          onPrev={() =>
            setSelectedMonth((m) =>
              stepPrevYearMonth(m, earliestSelectableMonth)
            )
          }
          onNext={() => setSelectedMonth((m) => stepNextYearMonth(m))}
        />
      </div>

      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-900">
          {language === "en"
            ? `Members (${monthLabel})`
            : `सदस्य (${monthLabel})`}
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {language === "en"
            ? `${monthMemberStatusRows.length} members`
            : `${monthMemberStatusRows.length} सदस्य`}
        </span>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input-field w-full pl-9"
          placeholder={
            language === "en"
              ? "Search member by name or phone"
              : "नाव किंवा फोनने सदस्य शोधा"
          }
          value={memberListSearch}
          onChange={(e) => setMemberListSearch(e.target.value)}
        />
        {memberListSearch ? (
          <button
            type="button"
            onClick={() => setMemberListSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label="Clear search"
          >
            <XCircle className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {monthMemberBillsLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : filteredMonthMemberStatusRows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-card">
          <CreditCard className="h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-600">
            {language === "en"
              ? "No members found."
              : "सदस्य सापडले नाहीत."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 pb-8">
          {filteredMonthMemberStatusRows.map((row) => {
            const status = row.monthlyStatus;
            const due =
              row.remainingAmount == null
                ? null
                : Math.max(0, Number(row.remainingAmount || 0));
            const isPaid = status === "Paid";
            const isPending = status === "Pending";
            const canCall = String(row?.phone || "").trim().length > 0;
            return (
              <li
                key={String(row.memberId)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-card"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    {language === "mr"
                      ? row.nameMr || row.name || "Unknown"
                      : row.name || "Unknown"}
                  </span>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      isPaid
                        ? "bg-emerald-100 text-emerald-800"
                        : isPending
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {language === "en" ? "Due" : "थकबाकी"}{" "}
                    {due == null ? "-" : formatCurrency(due)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCallPress(row)}
                    disabled={!canCall}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white disabled:bg-slate-400"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {language === "en" ? "Call" : "कॉल"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        title={language === "en" ? "Payment History" : "पेमेंट इतिहास"}
        size="lg"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CreditCard className="h-14 w-14 text-slate-300" />
            <p className="mt-4 text-slate-600">
              {language === "en"
                ? "No payment records available."
                : "पेमेंट नोंदी उपलब्ध नाहीत."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {payments.map((item) => {
              const paid = Number(item.paidAmount) || 0;
              const monthDate = new Date(item.month);
              const itemMonthLabel = getMonthLabel(
                monthDate.getFullYear() * 12 + monthDate.getMonth(),
                language
              );
              const name =
                language === "mr"
                  ? item.studentNameMr || item.studentName || "Unknown"
                  : item.studentName || "Unknown";
              return (
                <li
                  key={item._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{name}</span>
                    <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      Paid
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2 py-1">
                      {itemMonthLabel}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1">
                      {formatDisplayDate(item.date)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1">
                      {item.paymentMethod || "Cash"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      Paid {formatCurrency(paid)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(item)}
                      disabled={deletingPaymentId === item._id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-70"
                    >
                      {deletingPaymentId === item._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {language === "en" ? "Delete" : "हटवा"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={modalVisible}
        onClose={closeRecordModal}
        title={language === "en" ? "Record Payment" : "पेमेंट नोंदवा"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Member Name *" : "सदस्याचे नाव *"}
            </label>
            <button
              type="button"
              onClick={() => setShowMemberPicker((p) => !p)}
              className="input-field flex w-full items-center justify-between text-left"
            >
              <span
                className={
                  selectedMember ? "text-slate-900" : "text-slate-400"
                }
              >
                {selectedMember
                  ? language === "mr"
                    ? selectedMember.nameMr || selectedMember.name
                    : selectedMember.name
                  : language === "en"
                    ? "Select member"
                    : "सदस्य निवडा"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            {showMemberPicker ? (
              <div className="mt-2 max-h-52 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <input
                  type="search"
                  className="input-field m-2 w-[calc(100%-1rem)] border-0 bg-slate-100"
                  placeholder={
                    language === "en" ? "Search member name" : "सदस्य नाव शोधा"
                  }
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                />
                <ul className="max-h-40 overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <li key={String(m._id)}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => selectMember(m)}
                      >
                        {language === "mr"
                          ? m.nameMr || m.name || "-"
                          : m.name || "-"}
                      </button>
                    </li>
                  ))}
                  {filteredMembers.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-slate-500">
                      {language === "en"
                        ? "No members found"
                        : "सदस्य सापडले नाहीत"}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en"
                ? "Total Due (All Months)"
                : "एकूण थकबाकी"}
            </label>
            <div className="input-field bg-slate-100 font-bold">
              {formatCurrency(totalDue)}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Month *" : "महिना *"}
            </label>
            <button
              type="button"
              onClick={() => setShowMonthPicker((p) => !p)}
              className="input-field flex w-full items-center justify-between text-left"
            >
              <span
                className={
                  selectedDueMonth ? "text-slate-900" : "text-slate-400"
                }
              >
                {selectedDueMonth
                  ? getMonthLabel(
                      new Date(selectedDueMonth).getFullYear() * 12 +
                        new Date(selectedDueMonth).getMonth(),
                      language
                    )
                  : language === "en"
                    ? "Select due month"
                    : "थकबाकी महिना निवडा"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            {showMonthPicker ? (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                {dueMonths.map((m) => {
                  const d = new Date(m.month);
                  const mv = toYearMonthValue(m.month);
                  return (
                    <li key={String(m.month)}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        onClick={() => selectDueMonth(mv)}
                      >
                        {getMonthLabel(
                          d.getFullYear() * 12 + d.getMonth(),
                          language
                        )}{" "}
                        ({formatCurrency(m.due)})
                      </button>
                    </li>
                  );
                })}
                {dueMonths.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-slate-500">
                    {language === "en"
                      ? "No due months available"
                      : "थकबाकी महिने उपलब्ध नाहीत"}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en"
                ? "Due Amount (Selected Month)"
                : "निवडलेल्या महिन्याची थकबाकी"}
            </label>
            <div className="input-field bg-slate-100 font-bold">
              {formatCurrency(selectedMonthDue)}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Paid Amount *" : "भरलेली रक्कम *"}
            </label>
            <input
              type="text"
              inputMode="decimal"
              className={`input-field w-full ${isOverpay ? "border-red-500 ring-1 ring-red-500" : ""}`}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder={language === "en" ? "e.g. 500" : "उदा. ५००"}
            />
            {isOverpay ? (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {language === "en"
                  ? `Amount must be ≤ ${formatCurrency(selectedMonthDueNumber)}`
                  : `रक्कम ${formatCurrency(selectedMonthDueNumber)} पेक्षा जास्त नसावी`}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en"
                ? "Due After This Payment"
                : "या पेमेंटनंतरची थकबाकी"}
            </label>
            <div className="input-field bg-slate-100 font-bold">
              {formatCurrency(dueAfterPayment)}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Payment Mode" : "पेमेंट पद्धत"}
            </label>
            <button
              type="button"
              onClick={() => setShowModePicker((p) => !p)}
              className="input-field flex w-full items-center justify-between text-left"
            >
              <span>{paymentMethod}</span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            {showModePicker ? (
              <ul className="mt-2 rounded-xl border border-slate-200">
                {["Cash", "UPI"].map((mode) => (
                  <li key={mode}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setPaymentMethod(mode);
                        if (mode !== "UPI") setUpiTransactionId("");
                        setShowModePicker(false);
                      }}
                    >
                      {mode}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {paymentMethod === "UPI" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                {language === "en"
                  ? "UPI Transaction ID *"
                  : "UPI व्यवहार आयडी *"}
              </label>
              <input
                type="text"
                className="input-field w-full"
                value={upiTransactionId}
                onChange={(e) => setUpiTransactionId(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Enter UPI transaction ID"
                    : "UPI व्यवहार आयडी टाका"
                }
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleMarkPayment}
            disabled={submitting}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : null}
            {language === "en" ? "Mark Payment" : "पेमेंट नोंदवा"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
