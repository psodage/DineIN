import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  KeyRound,
  LogOut,
  Pencil,
  User,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { displayMealPlanMr, displayStatusMr } from "../../lib/memberLabelsMr";
import { formatCurrencyINR } from "../../lib/dateUtils";
import Button from "../../components/ui/Button";
import LoadingOverlay from "../../components/ui/LoadingOverlay";
import Modal from "../../components/ui/Modal";

export default function ProfileTab({ onTabChange }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/members/${user.id}`);
      setMember(res?.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) return <LoadingOverlay visible />;

  const memberName = member?.name || user?.name || "Member";
  const statusEn = member?.status || "N/A";
  const mealPlanEn = member?.mealPlan || "N/A";
  const status = displayStatusMr(language, statusEn, member?.statusMr);
  const mealPlan = displayMealPlanMr(language, mealPlanEn, member?.mealPlanMr);
  const dueAmount = Number(member?.dueAmount ?? 0);
  const totalFee =
    mealPlanEn === "Both" ? 3000 : mealPlanEn === "Lunch" || mealPlanEn === "Dinner" ? 1500 : member?.totalMessFee;

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-white pb-16">
      <header className="safe-top rounded-b-[26px] bg-accent px-5 pb-8 pt-4 text-white">
        <div className="flex justify-end">
          <div className="h-7" />
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">My Profile</h1>
        <p className="text-sm text-white/85">Manage your personal account details</p>
      </header>

      <div className="space-y-4 px-4 -mt-4">
        {/* User Card */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4 flex items-center gap-4 animate-fade-in">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-accent/20 bg-accent/10 text-accent">
            <User className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold text-ink">{memberName}</h2>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">Room owner: {member?.roomOwnerName || "N/A"}</p>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="rounded-2xl border border-slate-100 bg-surface grid grid-cols-2 gap-3 p-4">
          <div>
            <p className="text-xs text-muted">Meal plan</p>
            <p className="font-extrabold text-ink">{mealPlan}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Mess fee</p>
            <p className="font-extrabold text-ink">
              {typeof totalFee === "number" ? formatCurrencyINR(totalFee) : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Due amount</p>
            <p className={`font-extrabold ${dueAmount > 0 ? "text-red-600" : "text-blue-600"}`}>
              {formatCurrencyINR(dueAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Phone</p>
            <p className="font-extrabold text-ink">{member?.phone || "N/A"}</p>
          </div>
        </div>

        {[
          { icon: Pencil, label: "Edit profile", to: "/profile/edit" },
          { icon: KeyRound, label: "Change password", to: "/profile/change-password" },

        ].map(({ icon: Icon, label, to }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-surface p-4 shadow-sm transition hover:bg-slate-100"
          >
            <Icon className="h-5 w-5 text-accent" />
            <span className="flex-1 text-left font-bold text-ink">{label}</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </button>
        ))}

        <Button variant="danger" className="w-full" onClick={() => setLogoutOpen(true)}>
          <LogOut className="h-5 w-5" />
          Log out
        </Button>
      </div>

      <Modal
        open={logoutOpen}
        title="Log out?"
        onClose={() => setLogoutOpen(false)}
        actions={
          <>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLogout}>
              Log out
            </Button>
          </>
        }
      >
        <p className="mb-2">Are you sure you want to log out?</p>
      </Modal>
    </div>
  );
}
