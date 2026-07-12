import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

export default function MembersApproval() {
  const { isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingApprovalId, setUpdatingApprovalId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/pending-registrations");
      const rows = Array.isArray(res.data) ? res.data : [];
      setPendingApprovals(rows);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to load pending member approvals"
            : "प्रलंबित सदस्य मंजुरी लोड करता आली नाही")
      );
      setPendingApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingApprovals();
    }
  }, [isAuthenticated, fetchPendingApprovals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPendingApprovals();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPendingApprovals]);

  const updateApprovalStatus = async (pendingId, status) => {
    try {
      setUpdatingApprovalId(pendingId);
      const endpoint =
        status === "Approved"
          ? `/api/pending-registrations/approve/${pendingId}`
          : `/api/pending-registrations/reject/${pendingId}`;
      await api.put(endpoint, {});
      setPendingApprovals((prev) => prev.filter((item) => item._id !== pendingId));
      Alert.alert(
        t("alert_success"),
        status === "Approved"
          ? language === "en"
            ? "Member request approved"
            : "सदस्य विनंती मंजूर केली"
          : language === "en"
            ? "Member request rejected"
            : "सदस्य विनंती नाकारली"
      );
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to update member approval"
            : "सदस्य मंजुरी अपडेट करता आली नाही")
      );
    } finally {
      setUpdatingApprovalId(null);
    }
  };

  const title =
    language === "en" ? "Members Approval" : "सदस्य मंजुरी";

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={title}
          subtitle={
            language === "en"
              ? "Pending member registrations"
              : "सदस्यांच्या प्रलंबित नोंदणी विनंत्या"
          }
          backTo="/members"
        />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={onRefresh}
          disabled={refreshing || loading}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing
            ? language === "en"
              ? "Refreshing…"
              : "रिफ्रेश…"
            : language === "en"
              ? "Refresh"
              : "रिफ्रेश"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <CheckCircle2 className="h-16 w-16 text-slate-300" />
          <p className="mt-4 text-base">
            {language === "en"
              ? "No pending member approvals."
              : "प्रलंबित सदस्य मंजुरी नाही."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pb-8">
          {pendingApprovals.map((item) => {
            const name =
              language === "mr"
                ? item?.nameMr || item?.name
                : item?.name || item?.nameMr;

            const roomOwnerName =
              language === "mr"
                ? item?.roomOwnerNameMr || item?.roomOwnerName
                : item?.roomOwnerName || item?.roomOwnerNameMr;

            const busy = updatingApprovalId === item._id;

            return (
              <li key={item._id} className="card-panel">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex-1 text-base font-bold text-slate-900">
                    {name ||
                      (language === "en" ? "Unknown Member" : "अज्ञात सदस्य")}
                  </h2>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {language === "en" ? "Pending" : "प्रलंबित"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {language === "en" ? "Room Owner" : "रूम मालक"}:{" "}
                  {roomOwnerName ||
                    (language === "en" ? "N/A" : "उपलब्ध नाही")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {language === "en" ? "Phone" : "फोन"}:{" "}
                  {item?.phone ||
                    (language === "en" ? "N/A" : "उपलब्ध नाही")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {language === "en" ? "Meal Plan" : "जेवण योजना"}:{" "}
                  {item?.mealPlan ||
                    (language === "en" ? "N/A" : "उपलब्ध नाही")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {language === "en" ? "Email" : "ईमेल"}:{" "}
                  {item?.email ||
                    (language === "en" ? "N/A" : "उपलब्ध नाही")}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1 bg-green-600 hover:bg-green-500 focus:ring-green-500"
                    onClick={() => updateApprovalStatus(item._id, "Approved")}
                    disabled={busy}
                  >
                    {busy ? (
                      <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
                    ) : null}
                    {language === "en" ? "Approve" : "मंजूर करा"}
                  </button>
                  <button
                    type="button"
                    className="btn-danger flex-1"
                    onClick={() => updateApprovalStatus(item._id, "Rejected")}
                    disabled={busy}
                  >
                    {language === "en" ? "Reject" : "नाकार करा"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
