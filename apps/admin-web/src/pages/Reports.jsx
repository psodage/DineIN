import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Download,
  FileText,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { getMonthLabel } from "@/lib/monthLabels";
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
import Spinner from "@/components/ui/Spinner";

const formatDisplayDate = (d, language = "en") => {
  const date = d instanceof Date ? d : new Date(d);
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getReportPdfLabels = (language) => {
  const isMr = language === "mr";
  return {
    summary: isMr ? "सारांश" : "Summary",
    totalStudentPayments: isMr
      ? "विद्यार्थ्यांकडून मिळालेले एकूण पैसे"
      : "Total Student Payments",
    totalMessExpenses: isMr ? "एकूण मेस खर्च" : "Total Mess Expenses",
    totalSnacksRevenue: isMr ? "एकूण स्नॅक्स उत्पन्न" : "Total Snacks Revenue",
    finalBalance: isMr ? "अंतिम शिल्लक" : "Final Balance",
    paymentReport: isMr ? "पेमेंट रिपोर्ट" : "Payment Report",
    expensesReport: isMr ? "खर्च रिपोर्ट" : "Expenses Report",
    snacksReport: isMr ? "स्नॅक्स रिपोर्ट" : "Snacks Report",
    student: isMr ? "विद्यार्थी" : "Student",
    monthDate: isMr ? "महिना / तारीख" : "Month / Date",
    paid: isMr ? "भरलेले" : "Paid",
    remaining: isMr ? "शिल्लक" : "Remaining",
    status: isMr ? "स्थिती" : "Status",
    title: isMr ? "शीर्षक" : "Title",
    category: isMr ? "वर्ग" : "Category",
    date: isMr ? "तारीख" : "Date",
    amount: isMr ? "रक्कम" : "Amount",
    snack: isMr ? "स्नॅक" : "Snack",
    total: isMr ? "एकूण" : "Total",
    noPayments: isMr
      ? "या महिन्यासाठी कोणतेही पेमेंट रेकॉर्ड नाहीत."
      : "No payment records for this month.",
    noExpenses: isMr
      ? "या महिन्यासाठी कोणताही खर्च नाही."
      : "No expenses for this month.",
    noSnacks: isMr
      ? "या महिन्यासाठी कोणतीही स्नॅक्स विक्री नाही."
      : "No snack sales for this month.",
  };
};

const formatPaymentStatusForReport = (status, remaining, language) => {
  const raw = status || (Number(remaining) <= 0 ? "Paid" : "Pending");
  if (language !== "mr") return raw;
  const s = String(raw).toLowerCase();
  if (s === "paid") return "भरले";
  if (s === "pending") return "प्रलंबित";
  return raw;
};

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const CATEGORY_LABELS_MR = {
  Vegetables: "भाज्या",
  Milk: "दुग्ध",
  Grocery: "किराणा",
  Gas: "गॅस",
  Maintenance: "देखभाल",
  Other: "इतर",
};

const generateReportHtml = ({
  language,
  selectedMonth,
  monthPayments,
  monthExpenses,
  monthSnacks,
  totalPayments,
  totalExpenses,
  totalSnacksRevenue,
  finalBalance,
}) => {
  const L = getReportPdfLabels(language);
  const monthLabel = getMonthLabel(selectedMonth, language);
  const pageTitle = language === "en" ? "Mess Reports" : "मेस रिपोर्ट्स";

  const summarySection = `
      <h1>${pageTitle} - ${monthLabel}</h1>
      <hr />
      <h2>${L.summary}</h2>
      <table>
        <tr>
          <th align="left">${L.totalStudentPayments}</th>
          <td align="right">${formatCurrency(totalPayments)}</td>
        </tr>
        <tr>
          <th align="left">${L.totalMessExpenses}</th>
          <td align="right">${formatCurrency(totalExpenses)}</td>
        </tr>
        <tr>
          <th align="left">${L.totalSnacksRevenue}</th>
          <td align="right">${formatCurrency(totalSnacksRevenue)}</td>
        </tr>
        <tr>
          <th align="left">${L.finalBalance}</th>
          <td align="right">${formatCurrency(finalBalance)}</td>
        </tr>
      </table>
    `;

  const paymentsRows = (monthPayments || [])
    .map((p) => {
      const paid = Number(p.paidAmountComputed ?? p.paidAmount ?? p.amount ?? 0);
      const remaining = Number(p.remainingAmount || 0);
      const status = formatPaymentStatusForReport(null, remaining, language);
      const studentName =
        language === "mr"
          ? p.studentNameMr ||
            p.studentId?.nameMr ||
            p.studentName ||
            p.studentId?.name ||
            "—"
          : p.studentName || p.studentId?.name || "—";
      const monthDisplay = p.month
        ? getMonthLabel(
            new Date(p.month).getFullYear() * 12 + new Date(p.month).getMonth(),
            language
          )
        : p.date
          ? formatDisplayDate(p.date, language)
          : "—";
      return `
        <tr>
          <td>${studentName}</td>
          <td>${monthDisplay}</td>
          <td align="right">${formatCurrency(paid)}</td>
          <td align="right">${formatCurrency(remaining)}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");

  const expensesRows = (monthExpenses || [])
    .map((e) => `
        <tr>
          <td>${language === "mr" ? e.titleMr || e.title || "—" : e.title || "—"}</td>
          <td>${
            language === "mr"
              ? CATEGORY_LABELS_MR[e.category] || e.category || "—"
              : e.category || "—"
          }</td>
          <td>${formatDisplayDate(e.date, language)}</td>
          <td align="right">${formatCurrency(e.amount || 0)}</td>
        </tr>
      `)
    .join("");

  const snacksRows = (monthSnacks || [])
    .map((s) => `
        <tr>
          <td>${
            language === "mr"
              ? s.studentNameMr || s.studentName || "—"
              : s.studentName || "—"
          }</td>
          <td>${
            language === "mr"
              ? `${s.snackItemMr || s.snackItem} × ${s.quantity}`
              : `${s.snackItem} × ${s.quantity}`
          }</td>
          <td>${formatDisplayDate(s.date, language)}</td>
          <td align="right">${formatCurrency(s.totalPrice || 0)}</td>
        </tr>
      `)
    .join("");

  const paymentsSection = `
      <h2 style="margin-top:24px;">${L.paymentReport}</h2>
      ${
        paymentsRows
          ? `<table>
              <tr>
                <th>${L.student}</th>
                <th>${L.monthDate}</th>
                <th align="right">${L.paid}</th>
                <th align="right">${L.remaining}</th>
                <th>${L.status}</th>
              </tr>
              ${paymentsRows}
            </table>`
          : `<p>${L.noPayments}</p>`
      }
    `;

  const expensesSection = `
      <h2 style="margin-top:24px;">${L.expensesReport}</h2>
      ${
        expensesRows
          ? `<table>
              <tr>
                <th>${L.title}</th>
                <th>${L.category}</th>
                <th>${L.date}</th>
                <th align="right">${L.amount}</th>
              </tr>
              ${expensesRows}
            </table>`
          : `<p>${L.noExpenses}</p>`
      }
    `;

  const snacksSection = `
      <h2 style="margin-top:24px;">${L.snacksReport}</h2>
      ${
        snacksRows
          ? `<table>
              <tr>
                <th>${L.student}</th>
                <th>${L.snack}</th>
                <th>${L.date}</th>
                <th align="right">${L.total}</th>
              </tr>
              ${snacksRows}
            </table>`
          : `<p>${L.noSnacks}</p>`
      }
    `;

  const htmlLang = language === "mr" ? "mr" : "en";

  return `
    <html lang="${htmlLang}">
      <head>
        <meta charset="UTF-8" />
        <title>${pageTitle} - ${monthLabel}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Devanagari", sans-serif;
            padding: 24px;
            color: #111827;
          }
          h1 { font-size: 22px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin-top: 16px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #E5E7EB; padding: 6px 8px; font-size: 12px; }
          th { background-color: #F9FAFB; text-align: left; }
          @media print {
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        ${summarySection}
        ${paymentsSection}
        ${expensesSection}
        ${snacksSection}
      </body>
    </html>
  `;
};

const filterByMonth = (items, selectedMonth, dateField = "date") =>
  (items || []).filter((item) => {
    const d = new Date(item[dateField]);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

const filterPaymentsByMonth = (payments, selectedMonth) =>
  (payments || []).filter((p) => {
    const d = p.date ? new Date(p.date) : p.month ? new Date(p.month) : null;
    if (!d) return false;
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

export default function Reports() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [dueByMemberId, setDueByMemberId] = useState(() => new Map());

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const [payRes, expRes, snackRes] = await Promise.allSettled([
        api.get("/api/payments"),
        api.get("/api/expenses"),
        api.get("/api/snacks"),
      ]);
      const rawPayments = Array.isArray(payRes.value?.data) ? payRes.value.data : [];
      const normalizedPayments = rawPayments.map((p) => ({
        ...p,
        studentId: p?.memberId?._id || p?.memberId || p?.studentId,
        studentName: p?.memberName || p?.memberId?.name || p?.studentName || "",
        studentNameMr:
          p?.memberNameMr || p?.memberId?.nameMr || p?.studentNameMr || "",
      }));
      setPayments(normalizedPayments);
      setExpenses(Array.isArray(expRes.value?.data) ? expRes.value.data : []);
      const rawSnacks = Array.isArray(snackRes.value?.data) ? snackRes.value.data : [];
      setSnacks(
        rawSnacks.map((s) => ({
          ...s,
          studentName:
            s?.studentName ||
            s?.memberName ||
            s?.customerName ||
            s?.studentId?.name ||
            "—",
          studentNameMr:
            s?.studentNameMr ||
            s?.memberNameMr ||
            s?.customerNameMr ||
            s?.studentId?.nameMr ||
            "—",
        }))
      );
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const allMonths = useMemo(
    () =>
      [
        ...payments.map((p) => {
          const d = p.date ? new Date(p.date) : p.month ? new Date(p.month) : null;
          if (!d) return null;
          return d.getFullYear() * 12 + d.getMonth();
        }),
        ...expenses.map((e) => {
          const d = new Date(e.date);
          return d.getFullYear() * 12 + d.getMonth();
        }),
        ...snacks.map((s) => {
          const d = new Date(s.date);
          return d.getFullYear() * 12 + d.getMonth();
        }),
      ].filter((ym) => ym != null && !Number.isNaN(ym)),
    [payments, expenses, snacks]
  );

  const minReportMonth = useMemo(
    () =>
      combineMinYearMonth(
        allMonths.length > 0 ? Math.min(...allMonths) : getCurrentYearMonth(0)
      ),
    [allMonths]
  );

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(m, minReportMonth, getMaxSelectableYearMonth())
    );
  }, [minReportMonth]);

  const monthPayments = filterPaymentsByMonth(payments, selectedMonth);
  const monthExpenses = filterByMonth(expenses, selectedMonth);
  const monthSnacks = filterByMonth(snacks, selectedMonth);

  const selectedMonthParam = useMemo(() => {
    const year = Math.floor(selectedMonth / 12);
    const monthIndex = selectedMonth % 12;
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  }, [selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get("/api/members/due-month", {
          params: { month: selectedMonthParam },
        });
        if (cancelled) return;
        const members = Array.isArray(res?.data?.members) ? res.data.members : [];
        const next = new Map(
          members
            .map((m) => {
              const id = m?.memberId ? String(m.memberId) : "";
              if (!id) return null;
              const due = Number(m?.dueAmount ?? m?.remainingAmount ?? 0);
              return [id, due];
            })
            .filter(Boolean)
        );
        setDueByMemberId(next);
      } catch {
        if (!cancelled) setDueByMemberId(new Map());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedMonthParam]);

  const monthPaymentReportRows = useMemo(() => {
    const byMember = new Map();
    for (const p of monthPayments) {
      const memberId = p?.studentId ? String(p.studentId) : "";
      if (!memberId) continue;
      const prev = byMember.get(memberId);
      const paidTxn = Number(p?.paidAmount || p?.amount || 0);
      const paidComputed = Number(
        p?.paidAmountComputed ?? p?.paidAmount ?? p?.amount ?? 0
      );
      const remaining = Number(p?.remainingAmount || 0);
      if (!prev) {
        byMember.set(memberId, {
          ...p,
          reportMemberId: memberId,
          paidAmount: paidTxn,
          paidAmountComputed: paidComputed,
          remainingAmount: remaining,
        });
        continue;
      }
      const nextPaidTxn = Number(prev.paidAmount || 0) + paidTxn;
      const nextPaidComputed = Math.max(
        Number(prev.paidAmountComputed || 0),
        paidComputed
      );
      const nextRemaining = Math.min(
        Number(prev.remainingAmount || 0),
        remaining
      );
      byMember.set(memberId, {
        ...prev,
        reportMemberId: memberId,
        paidAmount: nextPaidTxn,
        paidAmountComputed: nextPaidComputed,
        remainingAmount: nextRemaining,
      });
    }
    const rows = Array.from(byMember.values());
    rows.sort((a, b) => {
      const an = (
        language === "mr"
          ? a.studentNameMr || a.studentName || ""
          : a.studentName || ""
      ).toLowerCase();
      const bn = (
        language === "mr"
          ? b.studentNameMr || b.studentName || ""
          : b.studentName || ""
      ).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    return rows.map((row) => {
      const memberId =
        row?.reportMemberId != null
          ? String(row.reportMemberId)
          : row?.studentId
            ? String(row.studentId)
            : "";
      const due =
        memberId && dueByMemberId.has(memberId)
          ? Number(dueByMemberId.get(memberId) || 0)
          : null;
      return {
        ...row,
        remainingAmount:
          due != null ? due : Number(row?.remainingAmount || 0),
      };
    });
  }, [monthPayments, language, dueByMemberId]);

  const totalPayments = monthPayments.reduce(
    (sum, p) => sum + Number(p.paidAmount || p.amount || 0),
    0
  );
  const totalExpenses = monthExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const totalSnacksRevenue = monthSnacks.reduce(
    (sum, s) => sum + Number(s.totalPrice || 0),
    0
  );
  const finalBalance = totalPayments + totalSnacksRevenue - totalExpenses;

  const maxChartValue = Math.max(
    totalPayments,
    totalExpenses,
    totalSnacksRevenue,
    1
  );
  const chartPaymentsWidth = (totalPayments / maxChartValue) * 100;
  const chartExpensesWidth = (totalExpenses / maxChartValue) * 100;
  const chartSnacksWidth = (totalSnacksRevenue / maxChartValue) * 100;

  const maxYm = getMaxSelectableYearMonth();

  const handleExport = () => {
    if (!monthPayments.length && !monthExpenses.length && !monthSnacks.length) {
      Alert.alert(
        language === "en" ? "No data" : "माहिती नाही",
        language === "en"
          ? "There is no data for the selected month to export."
          : "निवडलेल्या महिन्यासाठी एक्सपोर्ट करण्यासाठी कोणतीही माहिती नाही."
      );
      return;
    }

    const html = generateReportHtml({
      language,
      selectedMonth,
      monthPayments: monthPaymentReportRows,
      monthExpenses,
      monthSnacks,
      totalPayments,
      totalExpenses,
      totalSnacksRevenue,
      finalBalance,
    });

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        Alert.alert(
          language === "en" ? "Export failed" : "एक्सपोर्ट अयशस्वी",
          language === "en"
            ? "Please allow pop-ups to print or save the report as PDF."
            : "PDF म्हणून प्रिंट/सेव्ह करण्यासाठी पॉप-अप परवानगी द्या."
        );
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
      };
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          // ignore
        }
      }, 500);
    } catch (error) {
      console.error("PDF export error", error);
      Alert.alert(
        language === "en" ? "Export failed" : "एक्सपोर्ट अयशस्वी",
        language === "en"
          ? "Could not export the report to PDF. Please try again."
          : "रिपोर्ट PDF मध्ये एक्सपोर्ट करता आला नाही. कृपया पुन्हा प्रयत्न करा."
      );
    }
  };

  const pageTitle = language === "en" ? "Mess Reports" : "मेस रिपोर्ट्स";

  const renderPaymentCard = (item) => {
    const paid = Number(item.paidAmountComputed ?? item.paidAmount ?? item.amount ?? 0);
    const remaining = Number(item.remainingAmount || 0);
    const status = remaining <= 0 ? "Paid" : "Pending";
    const studentName =
      language === "mr"
        ? item.studentNameMr ||
          item.studentId?.nameMr ||
          item.studentName ||
          item.studentId?.name ||
          "—"
        : item.studentName || item.studentId?.name || "—";
    const monthDisplay = item.month
      ? getMonthLabel(
          new Date(item.month).getFullYear() * 12 + new Date(item.month).getMonth(),
          language
        )
      : item.date
        ? formatDisplayDate(item.date, language)
        : "—";
    return (
      <li
        key={item._id || `${studentName}-${item.month}`}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{studentName}</h3>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {status}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          <span className="text-slate-500">Month: </span>
          {monthDisplay}
        </p>
        <p className="text-sm text-slate-900">
          <span className="text-slate-500">Paid: </span>
          {formatCurrency(paid)}
        </p>
        <p className="text-sm text-slate-900">
          <span className="text-slate-500">Remaining: </span>
          {formatCurrency(remaining)}
        </p>
      </li>
    );
  };

  const EmptyList = ({ message }) => (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
      <FileText className="h-12 w-12 text-slate-300" />
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title={pageTitle} />

      <div className="mb-6">
        <MonthNavigator
          yearMonth={selectedMonth}
          language={language}
          canPrev={selectedMonth > minReportMonth}
          canNext={selectedMonth < maxYm}
          onPrev={() =>
            setSelectedMonth((m) => stepPrevYearMonth(m, minReportMonth))
          }
          onNext={() => setSelectedMonth((m) => stepNextYearMonth(m))}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card flex flex-col gap-2">
              <CreditCard className="h-6 w-6 text-emerald-600" />
              <p className="text-xs font-medium text-slate-500">
                {language === "en"
                  ? "Total Student Payments"
                  : "विद्यार्थ्यांकडून मिळालेले एकूण पैसे"}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(totalPayments)}
              </p>
            </div>
            <div className="card flex flex-col gap-2">
              <Wallet className="h-6 w-6 text-red-600" />
              <p className="text-xs font-medium text-slate-500">
                {language === "en" ? "Total Mess Expenses" : "एकूण मेस खर्च"}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="card flex flex-col gap-2">
              <UtensilsCrossed className="h-6 w-6 text-blue-600" />
              <p className="text-xs font-medium text-slate-500">
                {language === "en"
                  ? "Total Snacks Revenue"
                  : "एकूण स्नॅक्स उत्पन्न"}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(totalSnacksRevenue)}
              </p>
            </div>
            <div className="card flex flex-col gap-2">
              <TrendingUp className="h-6 w-6 text-violet-600" />
              <p className="text-xs font-medium text-slate-500">
                {language === "en" ? "Final Balance" : "अंतिम शिल्लक"}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(finalBalance)}
              </p>
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="mb-4 font-semibold text-slate-900">
              {language === "en" ? "Summary Comparison" : "सारांश तुलना"}
            </h2>
            {[
              {
                label: language === "en" ? "Payments" : "पेमेंट्स",
                width: chartPaymentsWidth,
                color: "bg-emerald-600",
              },
              {
                label: language === "en" ? "Expenses" : "खर्च",
                width: chartExpensesWidth,
                color: "bg-red-600",
              },
              {
                label: language === "en" ? "Snacks" : "स्नॅक्स",
                width: chartSnacksWidth,
                color: "bg-blue-600",
              },
            ].map((bar) => (
              <div key={bar.label} className="mb-3">
                <p className="mb-1 text-sm font-medium text-slate-600">{bar.label}</p>
                <div className="h-5 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className={`h-full rounded-lg ${bar.color}`}
                    style={{ width: `${bar.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="btn-primary mb-8 flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Download className="h-5 w-5" />
            {language === "en"
              ? "Export Report (PDF)"
              : "रिपोर्ट एक्सपोर्ट करा (PDF)"}
          </button>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              {language === "en" ? "Payment Report" : "पेमेंट रिपोर्ट"}
            </h2>
            {monthPaymentReportRows.length === 0 ? (
              <EmptyList
                message={
                  language === "en"
                    ? "No payment records for this month"
                    : "या महिन्यासाठी कोणतेही पेमेंट रेकॉर्ड नाहीत"
                }
              />
            ) : (
              <ul className="space-y-3">{monthPaymentReportRows.map(renderPaymentCard)}</ul>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              {language === "en" ? "Expenses Report" : "खर्च रिपोर्ट"}
            </h2>
            {monthExpenses.length === 0 ? (
              <EmptyList
                message={
                  language === "en"
                    ? "No expenses for this month"
                    : "या महिन्यासाठी कोणताही खर्च नाही"
                }
              />
            ) : (
              <ul className="space-y-3">
                {monthExpenses.map((item) => (
                  <li
                    key={item._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
                  >
                    <div className="mb-2 flex justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {language === "mr"
                          ? item.titleMr || item.title || "—"
                          : item.title || "—"}
                      </h3>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {language === "mr"
                          ? CATEGORY_LABELS_MR[item.category] ||
                            item.category ||
                            "—"
                          : item.category || "—"}
                      </span>
                      <span className="text-slate-500">
                        {formatDisplayDate(item.date, language)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              {language === "en" ? "Snacks Report" : "स्नॅक्स रिपोर्ट"}
            </h2>
            {monthSnacks.length === 0 ? (
              <EmptyList
                message={
                  language === "en"
                    ? "No snack sales for this month"
                    : "या महिन्यासाठी कोणतीही स्नॅक्स विक्री नाही"
                }
              />
            ) : (
              <ul className="space-y-3">
                {monthSnacks.map((item) => (
                  <li
                    key={item._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
                  >
                    <div className="mb-2 flex justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {language === "mr"
                          ? item.studentNameMr || item.studentName || "—"
                          : item.studentName || "—"}
                      </h3>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      Snack:{" "}
                      {language === "mr"
                        ? item.snackItemMr || item.snackItem
                        : item.snackItem}{" "}
                      × {item.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDisplayDate(item.date, language)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
