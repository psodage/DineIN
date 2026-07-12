import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, LogOut, Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { SIDEBAR_NAV } from "./navConfig";
import logo from "@/assets/logo2.png";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-700/80 px-4 py-5">
        <img src={logo} alt="DineIN" className="h-10 w-10 rounded-lg object-contain bg-white p-1" />
        <div>
          <p className="text-base font-bold text-white">DineIN</p>
          <p className="text-xs text-slate-400">Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.title || t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-700/80 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-64 shrink-0 bg-surface lg:block">{sidebar}</aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative h-full w-64 bg-surface shadow-elevated animate-slide-up">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur safe-top">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="lg:hidden">
                <p className="text-sm font-bold text-slate-900">DineIN Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <button
                type="button"
                className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:block"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-xs text-slate-500">{t("dashboard_welcome")}</p>
                <p className="max-w-[180px] truncate text-sm font-semibold text-slate-900">
                  {user?.email || user?.name || "Admin"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
