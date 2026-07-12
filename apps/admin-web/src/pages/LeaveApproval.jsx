import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  Phone,
  PlusCircle,
  TrendingUp,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { fetchMemberDirectory } from "@/lib/memberDirectory";
import { Alert } from "@/utils/dialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

const STATUS_COLORS = {
  Pending: { bg: "bg-amber-100", text: "text-amber-900" },
  Approved: { bg: "bg-green-100", text: "text-green-800" },
  Rejected: { bg: "bg-red-100", text: "text-red-800" },
};

function getLocalTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function normalizeMemberStatus(member) {
  const s = String(member?.status || "Active").trim().toLowerCase();
  if (s === "inactive") return "inactive";
  return "active";
}

function formatLeaveYmd(value) {
  if (value == null || value === "") return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().split("T")[0];
  } catch {
    return "-";
  }
}

/** Open attachment or external document URLs in a new tab (web). */
function openAttachmentUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return;
  const href = raw.startsWith("http") ? raw : `${window.location.origin}${raw.startsWith("/") ? "" : "/"}${raw}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

function getLeaveAttachmentUrl(item) {
  return (
    item?.attachmentUrl ||
    item?.attachment ||
    item?.proofUrl ||
    item?.documentUrl ||
    item?.fileUrl ||
    null
  );
}

export default function LeaveApproval() {
  const { language } = useLanguage();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [manualType, setManualType] = useState("Leave");
  const [manualStartDate, setManualStartDate] = useState("");
  const [manualEndDate, setManualEndDate] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/leave/all");
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to load leave requests");
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const rows = await fetchMemberDirectory(api);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to load members");
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    fetchMembers();
  }, [fetchLeaves, fetchMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchLeaves(), fetchMembers()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeaves, fetchMembers]);

  const filteredMembers = useMemo(() => {
    const q = String(memberQuery || "").trim().toLowerCase();
    if (!q) return members;
    return (members || []).filter((m) => {
      const en = String(m?.name || "").toLowerCase();
      const mr = String(m?.nameMr || "").toLowerCase();
      const phone = String(m?.phone || "").toLowerCase();
      return en.includes(q) || mr.includes(q) || phone.includes(q);
    });
  }, [members, memberQuery]);

  useEffect(() => {
    if (!selectedMember) return;
    const today = getLocalTodayYmd();
    if (normalizeMemberStatus(selectedMember) === "inactive") {
      setManualType("Activation");
      setManualEndDate(today);
      setManualStartDate("");
    } else {
      setManualType("Leave");
      setManualStartDate(today);
      setManualEndDate("");
    }
  }, [selectedMember]);

  const resetManualForm = useCallback(() => {
    setMemberQuery("");
    setSelectedMember(null);
    setManualType("Leave");
    setManualStartDate("");
    setManualEndDate("");
    setManualSubmitting(false);
  }, []);

  const openManualModal = useCallback(() => {
    resetManualForm();
    setManualModalVisible(true);
  }, [resetManualForm]);

  const closeManualModal = useCallback(() => {
    setManualModalVisible(false);
    resetManualForm();
  }, [resetManualForm]);

  const isValidYmd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

  const submitManualRequest = useCallback(async () => {
    if (manualSubmitting) return;
    if (!selectedMember?._id) {
      Alert.alert("Validation", "Please select member");
      return;
    }
    const type = manualType === "Activation" ? "Activation" : "Leave";
    const payload = { memberId: selectedMember._id, type };
    const today = getLocalTodayYmd();
    const statusNorm = normalizeMemberStatus(selectedMember);

    if (type === "Leave") {
      const start =
        statusNorm === "active" ? today : String(manualStartDate || "").trim();
      if (!isValidYmd(start)) {
        Alert.alert("Validation", "Start date must be YYYY-MM-DD");
        return;
      }
      if (statusNorm === "active" && start !== today) {
        Alert.alert(
          "Validation",
          language === "en" ? "Leave must start today." : "रजा आजच्या दिवसापासून सुरू होते."
        );
        return;
      }
      payload.startDate = start;
      if (String(manualEndDate || "").trim()) {
        if (!isValidYmd(manualEndDate)) {
          Alert.alert("Validation", "End date must be YYYY-MM-DD");
          return;
        }
        payload.endDate = manualEndDate.trim();
      }
    } else {
      const end =
        statusNorm === "inactive" ? today : String(manualEndDate || "").trim();
      if (!isValidYmd(end)) {
        Alert.alert("Validation", "Activation date must be YYYY-MM-DD");
        return;
      }
      if (statusNorm === "inactive" && end !== today) {
        Alert.alert(
          "Validation",
          language === "en"
            ? "Activation must use today as the end date."
            : "सक्रियकरणासाठी शेवटची तारीख आजच असावी."
        );
        return;
      }
      payload.endDate = end;
    }

    try {
      setManualSubmitting(true);
      const res = await api.post("/api/leave/admin/request", payload);
      const created = res?.data;
      if (created?._id) {
        setLeaves((prev) => [created, ...(prev || [])]);
      } else {
        await fetchLeaves();
      }
      closeManualModal();
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to create request");
    } finally {
      setManualSubmitting(false);
    }
  }, [
    closeManualModal,
    fetchLeaves,
    manualEndDate,
    manualStartDate,
    manualSubmitting,
    manualType,
    selectedMember,
    language,
  ]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      const endpoint =
        status === "Approved" ? `/api/leave/approve/${id}` : `/api/leave/reject/${id}`;
      const res = await api.put(endpoint, {});
      setLeaves((prev) =>
        prev.map((l) => (l._id === id ? { ...l, status: res.data.status } : l))
      );
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to update leave status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert(
        language === "en" ? "No phone number" : "फोन नंबर उपलब्ध नाही",
        language === "en"
          ? "This member does not have a phone number saved."
          : "या सदस्याचा फोन नंबर जतन केलेला नाही."
      );
      return;
    }
    window.open(`tel:${String(phone).trim()}`, "_self");
  };

  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const historyLeaves = leaves.filter((l) => l.status !== "Pending");

  const getMemberDisplayName = useCallback(
    (item) => {
      const unknownMemberText =
        language === "en" ? "Unknown Member" : "अज्ञात सदस्य";
      if (language === "mr") {
        return (
          item.studentNameMr ||
          item.memberNameMr ||
          item.memberId?.nameMr ||
          item.studentId?.nameMr ||
          item.memberName ||
          item.studentName ||
          item.memberId?.name ||
          item.studentId?.name ||
          unknownMemberText
        );
      }
      return (
        item.studentName ||
        item.memberName ||
        item.memberId?.name ||
        item.studentId?.name ||
        item.studentNameMr ||
        item.memberNameMr ||
        item.memberId?.nameMr ||
        item.studentId?.nameMr ||
        unknownMemberText
      );
    },
    [language]
  );

  const renderLeaveCard = (item, { showActions = false } = {}) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.Pending;
    const studentName = getMemberDisplayName(item);
    const phone = item.memberId?.phone || item.studentId?.phone;
    const isActivation = item.type === "Activation";
    const streak = Number(item.leaveStatCurrentStreak ?? 0);
    const startDate = formatLeaveYmd(item.startDate);
    const latestPriorLeaveStart = formatLeaveYmd(item.latestLeaveStartDate);
    const busy = updatingId === item._id;
    const attachmentUrl = getLeaveAttachmentUrl(item);

    return (
      <li key={item._id} className="card-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900">{studentName}</h3>
            {isActivation ? (
              <p className="mt-1 text-xs font-semibold text-blue-700">
                {language === "en"
                  ? "Activation Request"
                  : "सदस्यता सक्रिय करण्याची विनंती"}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
          >
            {item.status}
          </span>
        </div>

        {isActivation ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {language === "en" ? "Latest leave start" : "अलीकडील रजा सुरू"}:{" "}
              <strong className="text-slate-900">{latestPriorLeaveStart}</strong>
            </span>
          </p>
        ) : (
          <>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {language === "en" ? "Leave start" : "रजा सुरू"}:{" "}
                <strong className="text-slate-900">{startDate}</strong>
              </span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span>
                {language === "en" ? "Streak (this month)" : "सलगी (हा महिना)"}:{" "}
                <strong className="text-slate-900">{streak}</strong>
              </span>
            </p>
          </>
        )}

        {attachmentUrl ? (
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-brand-600 hover:underline"
            onClick={() => openAttachmentUrl(attachmentUrl)}
          >
            {language === "en" ? "View attachment" : "संलग्नक पहा"}
          </button>
        ) : null}

        {showActions ? (
          busy ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-2">
              <Spinner className="h-5 w-5" />
              <span className="text-sm text-slate-500">
                {language === "en" ? "Updating…" : "अद्यतनित करत आहे…"}
              </span>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary flex-1 bg-sky-500 text-sm hover:bg-sky-400"
                onClick={() => handleCall(phone)}
              >
                <Phone className="h-4 w-4" />
                {language === "en" ? "Call" : "कॉल"}
              </button>
              <button
                type="button"
                className="btn-primary flex-1 bg-green-600 text-sm hover:bg-green-500 disabled:opacity-60"
                disabled={item.status === "Approved"}
                onClick={() => updateStatus(item._id, "Approved")}
              >
                <CheckCircle className="h-4 w-4" />
                {language === "en" ? "Approve" : "मान्य"}
              </button>
              <button
                type="button"
                className="btn-danger flex-1 text-sm disabled:opacity-60"
                disabled={item.status === "Rejected"}
                onClick={() => updateStatus(item._id, "Rejected")}
              >
                <XCircle className="h-4 w-4" />
                {language === "en" ? "Reject" : "नाकार"}
              </button>
            </div>
          )
        ) : null}
      </li>
    );
  };

  const renderHistoryItem = (item) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.Pending;
    const studentName = getMemberDisplayName(item);
    const isActivation = item.type === "Activation";
    const streak = Number(item.leaveStatCurrentStreak ?? 0);
    const startDate = formatLeaveYmd(item.startDate);
    const latestPriorLeaveStart = formatLeaveYmd(item.latestLeaveStartDate);
    const requestLabel =
      item.type === "Activation"
        ? language === "en"
          ? "Activation request"
          : "सदस्यता सक्रिय करण्याची विनंती"
        : language === "en"
          ? "Leave request"
          : "रजा विनंती";
    const attachmentUrl = getLeaveAttachmentUrl(item);

    return (
      <li key={item._id} className="card-panel">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">{studentName}</h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
          >
            {item.status}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {language === "en" ? "Reason" : "कारण"}: {requestLabel}
        </p>
        {isActivation ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            {language === "en" ? "Latest leave start" : "अलीकडील रजा सुरू"}: {latestPriorLeaveStart}
          </p>
        ) : (
          <>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              {language === "en" ? "Leave start" : "रजा सुरू"}: {startDate}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <TrendingUp className="h-4 w-4" />
              {language === "en" ? "Streak (this month)" : "सलगी (हा महिना)"}: {streak}
            </p>
          </>
        )}
        {attachmentUrl ? (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-brand-600 hover:underline"
            onClick={() => openAttachmentUrl(attachmentUrl)}
          >
            {language === "en" ? "View attachment" : "संलग्नक पहा"}
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={language === "en" ? "Leave Approvals" : "रजा मंजुरी"}
        />
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={openManualModal} aria-label="Manual request">
            <PlusCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setHistoryModalVisible(true)}
            aria-label="History"
          >
            <Clock className="h-5 w-5" />
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "…" : language === "en" ? "Refresh" : "रीफ्रेश"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : pendingLeaves.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400">
          <Calendar className="h-16 w-16" />
          <p className="mt-4 text-slate-500">
            {language === "en"
              ? "No pending leave requests."
              : "कोणत्याही प्रलंबित रजा विनंत्या नाहीत."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pendingLeaves.map((item) => renderLeaveCard(item, { showActions: true }))}
        </ul>
      )}

      <Modal
        open={manualModalVisible}
        onClose={closeManualModal}
        title={language === "en" ? "Manual Request" : "हस्तचलित विनंती"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Member *" : "सदस्य *"}
            </label>
            <input
              className="input-field"
              placeholder={
                language === "en" ? "Search by name / phone" : "नाव / फोनने शोधा"
              }
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
              {membersLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : (
                filteredMembers.slice(0, 20).map((m) => {
                  const active = selectedMember?._id === m._id;
                  return (
                    <button
                      key={String(m._id)}
                      type="button"
                      className={`w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                      onClick={() => setSelectedMember(m)}
                    >
                      <p className="font-bold text-slate-900">
                        {language === "mr" ? m.nameMr || m.name : m.name || m.nameMr || "-"}
                      </p>
                      {m.phone ? (
                        <p className="text-xs font-medium text-slate-500">{m.phone}</p>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Request Type *" : "विनंती प्रकार *"}
            </label>
            {selectedMember ? (
              <span className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                {normalizeMemberStatus(selectedMember) === "inactive"
                  ? language === "en"
                    ? "Activation"
                    : "सक्रियकरण"
                  : language === "en"
                    ? "Leave"
                    : "रजा"}
              </span>
            ) : (
              <div className="flex gap-2">
                {["Leave", "Activation"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
                      manualType === t
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                    onClick={() => setManualType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {manualType === "Leave" ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {language === "en" ? "Start Date * (today)" : "सुरू तारीख * (आज)"}
                </label>
                {selectedMember && normalizeMemberStatus(selectedMember) === "active" ? (
                  <p className="rounded-xl bg-slate-200 px-4 py-3 font-bold text-slate-700">
                    {manualStartDate || getLocalTodayYmd()}
                  </p>
                ) : (
                  <input
                    type="date"
                    className="input-field"
                    value={manualStartDate}
                    onChange={(e) => setManualStartDate(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {language === "en"
                    ? "End Date (optional)"
                    : "शेवटची तारीख (ऐच्छिक)"}
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={manualEndDate}
                  onChange={(e) => setManualEndDate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {language === "en"
                  ? "Activation end date * (today)"
                  : "सक्रियकरण शेवटची तारीख * (आज)"}
              </label>
              {selectedMember && normalizeMemberStatus(selectedMember) === "inactive" ? (
                <p className="rounded-xl bg-slate-200 px-4 py-3 font-bold text-slate-700">
                  {manualEndDate || getLocalTodayYmd()}
                </p>
              ) : (
                <input
                  type="date"
                  className="input-field"
                  value={manualEndDate}
                  onChange={(e) => setManualEndDate(e.target.value)}
                />
              )}
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={manualSubmitting}
            onClick={submitManualRequest}
          >
            {manualSubmitting ? (
              <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
            ) : (
              language === "en" ? "Create Request" : "विनंती तयार करा"
            )}
          </button>
        </div>
      </Modal>

      <Modal
        open={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        title={language === "en" ? "Leave History" : "रजा इतिहास"}
        size="lg"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : historyLeaves.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            {language === "en" ? "No history found." : "कोणताही इतिहास आढळला नाही."}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
            {historyLeaves.map((item) => renderHistoryItem(item))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
