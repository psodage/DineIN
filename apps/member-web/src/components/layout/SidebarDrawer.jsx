import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  UtensilsCrossed,
  Calendar,
  Receipt,
  User,
  CalendarDays,
  History,
  Pencil,
  KeyRound,
  LogOut,
  X,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../lib/api";

const TRANSLATIONS = {
  en: {
    home: "Home",
    snacks: "Extra Snacks",
    leaves: "Leave Management",
    bill: "Bill Details",
    activity: "Activity Calendar",
    profile: "Profile Details",
    editProfile: "Edit Profile",
    changePassword: "Change Password",
    paymentHistory: "Payment History",
    snackHistory: "Snack Orders",
    leaveHistory: "Leave History",
    signOut: "Sign Out",
    statusActive: "Active",
    statusInactive: "Inactive",
    roomOwner: "Room Owner",
    signOutConfirm: "Are you sure you want to sign out?",
    cancel: "Cancel",
  },
  mr: {
    home: "होम",
    snacks: "अतिरिक्त स्नॅक्स",
    leaves: "रजा व्यवस्थापन",
    bill: "बिल तपशील",
    activity: "ऍक्टिव्हिटी कॅलेंडर",
    profile: "प्रोफाइल तपशील",
    editProfile: "प्रोफाइल संपादित करा",
    changePassword: "पासवर्ड बदला",
    paymentHistory: "पेमेंट इतिहास",
    snackHistory: "स्नॅक ऑर्डर्स",
    leaveHistory: "रजा इतिहास",
    signOut: "बाहेर पडा",
    statusActive: "सक्रिय",
    statusInactive: "निष्क्रिय",
    roomOwner: "खोली मालक",
    signOutConfirm: "तुम्ही नक्की बाहेर पडू इच्छिता का?",
    cancel: "रद्द करा",
  },
};

export default function SidebarDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const [member, setMember] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  useEffect(() => {
    if (!user?.id || !isOpen) return;
    api
      .get(`/api/members/${user.id}`)
      .then((res) => setMember(res?.data || null))
      .catch((err) => console.error("Failed to load profile for drawer", err));
  }, [user?.id, isOpen]);

  // Disable body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const memberName = member?.name || user?.name || "Member";
  const statusEn = member?.status || "Active";
  const isStatusActive = statusEn.trim().toLowerCase() === "active";
  const statusLabel = isStatusActive ? t.statusActive : t.statusInactive;

  const navigateTo = (path) => {
    onClose();
    navigate(path);
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    onClose();
    await logout();
    navigate("/", { replace: true });
  };

  const menuGroups = [
    {
      title: language === "mr" ? "मुख्य मेनू" : "Main Navigation",
      items: [
        { key: "home", label: t.home, icon: Home, path: "/dashboard?tab=home" },
        { key: "snacks", label: t.snacks, icon: UtensilsCrossed, path: "/dashboard?tab=snacks" },
        { key: "leaves", label: t.leaves, icon: Calendar, path: "/dashboard?tab=leaves" },
        { key: "bill", label: t.bill, icon: Receipt, path: "/dashboard?tab=bill" },
        { key: "profile", label: t.profile, icon: User, path: "/dashboard?tab=profile" },
      ],
    },
    {
      title: language === "mr" ? "इतिहास आणि क्रियाकलाप" : "History & Activity",
      items: [
        { key: "activity", label: t.activity, icon: CalendarDays, path: "/activity-calendar" },
        { key: "paymentHistory", label: t.paymentHistory, icon: CreditCard, path: "/bill/payments" },
        { key: "snackHistory", label: t.snackHistory, icon: History, path: "/snacks/history" },
        { key: "leaveHistory", label: t.leaveHistory, icon: History, path: "/leaves/history" },
      ],
    },
    {
      title: language === "mr" ? "खाते आणि सुरक्षा" : "Account & Settings",
      items: [
        { key: "editProfile", label: t.editProfile, icon: Pencil, path: "/profile/edit" },
        { key: "changePassword", label: t.changePassword, icon: KeyRound, path: "/profile/change-password" },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      {/* Sliding Drawer Container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-76 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Drawer Header */}
        <div className="safe-top relative overflow-hidden bg-gradient-to-br from-brand to-brand-dark p-5 pt-7 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 text-white shadow-sm transition hover:bg-white/40 active:scale-90"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-white/15 text-white">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-white mt-1.5">{memberName}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${isStatusActive ? "bg-emerald-400 animate-pulse" : "bg-slate-300"
                    }`}
                />
                <span className="text-[11px] font-bold text-white/80">{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted/80">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // Determine if active based on path comparison
                  const isTabMatch = item.path.includes("tab=") && location.search.includes(item.path.split("?")[1]);
                  const isPathMatch = !item.path.includes("tab=") && location.pathname === item.path;
                  const isActive = isTabMatch || isPathMatch;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigateTo(item.path)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${isActive
                        ? "bg-brand/10 text-brand shadow-sm"
                        : "text-slate-600 hover:bg-brand/5 hover:text-brand"
                        }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? "text-brand" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Footer with Sign Out */}
        <div className="border-t border-slate-100 p-4 safe-bottom">
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex w-full items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm font-bold text-red-600 transition-all active:scale-[0.98]"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>{t.signOut}</span>
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-extrabold text-ink">{t.signOut}</h3>
            <p className="mt-2 text-sm text-muted">{t.signOutConfirm}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/10 hover:bg-red-700 active:scale-95 transition-all"
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
