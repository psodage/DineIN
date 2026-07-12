import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  XCircle,
  ChevronRight,
  Users,
  PlusCircle,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { displayStatusMr } from "@/lib/memberLabelsMr";
import { fetchMemberDirectory } from "@/lib/memberDirectory";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

function toDateInputValue(date) {
  const d =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ManageMembers() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    roomOwnerName: "",
    phone: "",
    email: "",
    password: "",
    mealPlan: "Lunch",
    status: "Active",
    joiningDate: new Date(),
  });

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchMemberDirectory(api);
      setStudents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message || t("manage_members_alert_generic_error")
      );
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await api.get("/api/pending-registrations");
      const rows = Array.isArray(res.data) ? res.data : [];
      setPendingApprovalCount(rows.length);
    } catch {
      setPendingApprovalCount(0);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchStudents();
  }, [isAuthenticated, fetchStudents]);

  useEffect(() => {
    const q = (searchQuery || "").toLowerCase().trim();
    if (!q) {
      setFilteredStudents(students);
      return;
    }
    const filtered = students.filter((s) => {
      const name =
        language === "mr" ? s.nameMr || s.name || "" : s.name || "";
      const roomOwnerName =
        language === "mr"
          ? s.roomOwnerNameMr || s.roomOwnerName || s.roomNumber || ""
          : s.roomOwnerName || s.roomNumber || "";
      const rollNumber = s.rollNumber || "";

      return (
        name.toLowerCase().includes(q) ||
        roomOwnerName.toLowerCase().includes(q) ||
        rollNumber.toLowerCase().includes(q)
      );
    });
    setFilteredStudents(filtered);
  }, [searchQuery, students, language]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingApprovals();
    }
  }, [isAuthenticated, fetchPendingApprovals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStudents(), fetchPendingApprovals()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStudents, fetchPendingApprovals]);

  const openMemberDetails = (member) => {
    navigate(`/members/${member._id}`);
  };

  const updateNewMember = (key, value) => {
    setNewMember((prev) => ({ ...prev, [key]: value }));
  };

  const resetNewMemberForm = () => {
    setNewMember({
      name: "",
      roomOwnerName: "",
      phone: "",
      email: "",
      password: "",
      mealPlan: "Lunch",
      status: "Active",
      joiningDate: new Date(),
    });
  };

  const createMember = async () => {
    const payload = {
      name: String(newMember.name || "").trim(),
      roomOwnerName: String(newMember.roomOwnerName || "").trim(),
      phone: String(newMember.phone || "").trim(),
      email: String(newMember.email || "").trim(),
      password: String(newMember.password || "").trim(),
      mealPlan: ["Lunch", "Dinner", "Both"].includes(newMember.mealPlan)
        ? newMember.mealPlan
        : "Lunch",
      status: newMember.status === "Inactive" ? "Inactive" : "Active",
      joiningDate:
        newMember?.joiningDate instanceof Date &&
        !Number.isNaN(newMember.joiningDate.getTime())
          ? newMember.joiningDate.toISOString()
          : new Date().toISOString(),
    };

    if (!payload.name || !payload.roomOwnerName || !payload.phone || !payload.password) {
      Alert.alert(
        language === "en" ? "Validation error" : "तपासणी त्रुटी",
        language === "en"
          ? "Name, room owner, phone and password are required."
          : "नाव, रूम मालक, फोन आणि पासवर्ड आवश्यक आहेत."
      );
      return;
    }

    try {
      setCreatingMember(true);
      await api.post("/api/members", payload);
      await Promise.all([fetchStudents(), fetchPendingApprovals()]);
      resetNewMemberForm();
      setShowAddMemberForm(false);
      Alert.alert(
        language === "en" ? "Success" : "यशस्वी",
        language === "en"
          ? "Member added successfully."
          : "सदस्य यशस्वीरित्या जोडला."
      );
    } catch (err) {
      Alert.alert(
        language === "en" ? "Error" : "त्रुटी",
        err?.response?.data?.message ||
          (language === "en"
            ? "Failed to add member."
            : "सदस्य जोडता आला नाही.")
      );
    } finally {
      setCreatingMember(false);
    }
  };

  const title =
    language === "en" ? "Manage Members" : "सदस्य व्यवस्थापन";

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={title}
          backTo="/dashboard"
        />
        <div className="flex items-center gap-2">
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
          <Link
            to="/members-approval"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label={
              language === "en" ? "Members approval" : "सदस्य मंजुरी"
            }
          >
            <Users className="h-6 w-6" />
            {pendingApprovalCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {pendingApprovalCount > 9 ? "9+" : String(pendingApprovalCount)}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="card-panel mb-4 flex items-center gap-2 p-3">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="search"
          className="flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
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
            className="text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <XCircle className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="mb-4">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => setShowAddMemberForm((prev) => !prev)}
          disabled={creatingMember}
        >
          {showAddMemberForm ? (
            <MinusCircle className="h-5 w-5" />
          ) : (
            <PlusCircle className="h-5 w-5" />
          )}
          {showAddMemberForm
            ? language === "en"
              ? "Close Add Member"
              : "सदस्य जोडणे बंद करा"
            : language === "en"
              ? "Add New Member"
              : "नवीन सदस्य जोडा"}
        </button>

        {showAddMemberForm ? (
          <div className="card-panel mt-3 space-y-3">
            <input
              className="input-field"
              placeholder={language === "en" ? "Member name *" : "सदस्य नाव *"}
              value={newMember.name}
              onChange={(e) => updateNewMember("name", e.target.value)}
            />
            <input
              className="input-field"
              placeholder={
                language === "en" ? "Room owner name *" : "रूम मालक नाव *"
              }
              value={newMember.roomOwnerName}
              onChange={(e) => updateNewMember("roomOwnerName", e.target.value)}
            />
            <input
              className="input-field"
              type="tel"
              placeholder={language === "en" ? "Phone *" : "फोन *"}
              value={newMember.phone}
              onChange={(e) => updateNewMember("phone", e.target.value)}
            />
            <input
              className="input-field"
              type="email"
              placeholder={
                language === "en" ? "Email (optional)" : "ईमेल (ऐच्छिक)"
              }
              value={newMember.email}
              onChange={(e) => updateNewMember("email", e.target.value)}
              autoCapitalize="none"
            />
            <input
              className="input-field"
              type="password"
              placeholder={language === "en" ? "Password *" : "पासवर्ड *"}
              value={newMember.password}
              onChange={(e) => updateNewMember("password", e.target.value)}
              autoCapitalize="none"
            />
            <label className="block text-sm font-medium text-slate-700">
              {language === "en" ? "Joining date" : "जॉईनिंग तारीख"}
              <input
                type="date"
                className="input-field mt-1"
                max={toDateInputValue(new Date())}
                value={toDateInputValue(newMember.joiningDate)}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNewMember(
                    "joiningDate",
                    v ? new Date(`${v}T12:00:00`) : new Date()
                  );
                }}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {["Lunch", "Dinner", "Both"].map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    newMember.mealPlan === plan
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100"
                  }`}
                  onClick={() => updateNewMember("mealPlan", plan)}
                >
                  {plan}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {["Active", "Inactive"].map((state) => (
                <button
                  key={state}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    newMember.status === state
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100"
                  }`}
                  onClick={() => updateNewMember("status", state)}
                >
                  {state}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-primary flex-1 bg-green-600 hover:bg-green-500 focus:ring-green-500"
                onClick={createMember}
                disabled={creatingMember}
              >
                {creatingMember
                  ? language === "en"
                    ? "Adding..."
                    : "जोडत आहे..."
                  : language === "en"
                    ? "Save Member"
                    : "सदस्य सेव्ह करा"}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  resetNewMemberForm();
                  setShowAddMemberForm(false);
                }}
                disabled={creatingMember}
              >
                {language === "en" ? "Cancel" : "रद्द करा"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Users className="h-16 w-16 text-slate-300" />
          <p className="mt-4 text-base">
            {searchQuery
              ? language === "en"
                ? "No members match your search"
                : "तुमच्या शोधाशी जुळणारे सदस्य नाहीत"
              : language === "en"
                ? "No members found"
                : "सदस्य आढळले नाहीत"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pb-8">
          {filteredStudents.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => openMemberDetails(item)}
                className="card-panel flex w-full items-center justify-between gap-3 text-left transition hover:border-brand-200 hover:shadow-md"
              >
                <span className="flex-1 text-base font-semibold text-slate-900">
                  {language === "mr"
                    ? item.nameMr || item.name
                    : item.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      item.status === "Active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {displayStatusMr(
                      language,
                      item.status || "Active",
                      item.statusMr
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
