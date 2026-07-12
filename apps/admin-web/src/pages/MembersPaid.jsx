import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Search, Users, XCircle } from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { getMonthLabel } from "@/lib/monthLabels";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const parseMonthParamToYearMonth = (monthParam) => {
  const s = String(monthParam || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return year * 12 + monthIndex;
};

export default function MembersPaid() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { language } = useLanguage();

  const monthParam = String(
    searchParams.get("month") || location.state?.month || ""
  ).trim();
  const yearMonth = useMemo(
    () => parseMonthParamToYearMonth(monthParam),
    [monthParam]
  );
  const monthLabel = yearMonth != null ? getMonthLabel(yearMonth, language) : "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchPaidMembers = useCallback(async () => {
    if (!monthParam) {
      setErrorMsg(
        language === "mr"
          ? "महिना पॅरामीटर गायब आहे"
          : "Month parameter is missing"
      );
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get("/api/members/due-month", {
        params: { month: monthParam },
      });
      const rawMembers = Array.isArray(res?.data?.members)
        ? res.data.members
        : [];
      const paidMembers = rawMembers.filter(
        (m) =>
          Number(m?.totalBill || 0) > 0 && Number(m?.remainingAmount || 0) <= 0
      );
      setMembers(paidMembers);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (language === "mr"
          ? "पेमेंट पूर्ण सदस्य लोड करता आले नाहीत"
          : "Failed to load paid members");
      setErrorMsg(message);
      setMembers([]);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [monthParam, language]);

  useEffect(() => {
    fetchPaidMembers();
  }, [fetchPaidMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPaidMembers();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPaidMembers]);

  const filteredMembers = useMemo(() => {
    const q = (searchQuery || "").toLowerCase().trim();
    if (!q) return members;
    return members.filter((m) => {
      const name =
        language === "mr" ? m?.nameMr || m?.name || "" : m?.name || "";
      const roomOwnerName =
        language === "mr"
          ? m?.roomOwnerNameMr || m?.roomOwnerName || m?.roomNumber || ""
          : m?.roomOwnerName || m?.roomNumber || "";
      const rollNumber = m?.rollNumber || "";
      const status = m?.monthlyStatus || "";
      return (
        String(name).toLowerCase().includes(q) ||
        String(roomOwnerName).toLowerCase().includes(q) ||
        String(rollNumber).toLowerCase().includes(q) ||
        String(status).toLowerCase().includes(q)
      );
    });
  }, [members, searchQuery, language]);

  const title = language === "en" ? "Members Paid" : "पेमेंट पूर्ण सदस्य";

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={title} subtitle={monthLabel} backTo="/payments" />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="btn-secondary text-sm"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input-field w-full pl-10"
          placeholder={
            language === "en"
              ? "Search by name, ID or room owner"
              : "नाव, आयडी किंवा रूम मालकाने शोधा"
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <XCircle className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-card">
          <Users className="h-16 w-16 text-slate-300" />
          <p className="mt-4 text-slate-600">
            {errorMsg
              ? errorMsg
              : language === "en"
                ? `No paid members for ${monthLabel}.`
                : `${monthLabel} साठी पेमेंट पूर्ण सदस्य नाहीत.`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredMembers.map((item) => {
            const paid = Number(item?.paidAmount || 0);
            const totalBill = Number(item?.totalBill || 0);
            const displayName =
              language === "mr" ? item?.nameMr || item?.name : item?.name;
            const roomOwner =
              language === "mr"
                ? item?.roomOwnerNameMr ||
                  item?.roomOwnerName ||
                  item?.roomNumber
                : item?.roomOwnerName || item?.roomNumber;
            const key = String(
              item?.memberId?._id ||
                item?.memberId ||
                item?._id ||
                item?.rollNumber ||
                ""
            );
            return (
              <li
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {displayName || "Unknown"}
                  </h3>
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {language === "mr" ? "पूर्ण" : "Paid"}
                  </span>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-28 text-slate-500">
                      {language === "mr" ? "एकूण बिल:" : "Total bill:"}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {formatCurrency(totalBill)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 text-slate-500">
                      {language === "mr" ? "भरलेले:" : "Paid:"}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {formatCurrency(paid)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 text-slate-500">
                      {language === "mr" ? "रोल:" : "Roll:"}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {item?.rollNumber || "-"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 text-slate-500">
                      {language === "mr" ? "रूम मालक:" : "Room owner:"}
                    </dt>
                    <dd className="truncate font-medium text-slate-900">
                      {roomOwner || "-"}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
