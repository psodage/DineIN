import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { QrCode } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useLanguage } from "@/context/LanguageContext";
import { DASHBOARD_CARDS } from "@/components/layout/navConfig";
import { Alert } from "@/utils/dialog";

const DISABLED_IDS = new Set(["menu", "snackProducts", "leave", "qr"]);

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingLeaveCount = useCallback(async () => {
    try {
      const base = API_BASE_URL || "";
      const res = await axios.get(`${base}/api/leave/all`);
      const leaves = Array.isArray(res?.data) ? res.data : [];
      setPendingLeaveCount(
        leaves.filter((item) => String(item?.status || "").toLowerCase() === "pending").length
      );
    } catch {
      setPendingLeaveCount(0);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchPendingLeaveCount();
    const id = setInterval(fetchPendingLeaveCount, 30000);
    return () => clearInterval(id);
  }, [fetchPendingLeaveCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPendingLeaveCount();
    } finally {
      setRefreshing(false);
    }
  };

  const handleQrPress = () => {
    Alert.alert("Feature Disabled", "Functionality is disabled.");
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">{t("dashboard_welcome")}</h1>
          <p className="page-subtitle">{currentDateTime.toLocaleString()}</p>
        </div>
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
            onClick={handleQrPress}
            className="rounded-xl border border-slate-300 bg-slate-100 p-2.5 text-slate-400"
            aria-label="QR scanner"
          >
            <QrCode className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DASHBOARD_CARDS.map((card) => {
          const isDisabled = DISABLED_IDS.has(card.id) || card.disabled;
          const Icon = card.icon;
          const title = card.title || t(card.titleKey);
          const content = (
            <div
              className={`group relative flex flex-col rounded-2xl border p-6 transition ${
                isDisabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                  : "border-slate-200 bg-white shadow-card hover:border-brand-300 hover:shadow-elevated"
              }`}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                  isDisabled ? "bg-slate-200 text-slate-400" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{title}</h3>
                {card.id === "leave" && pendingLeaveCount > 0 ? (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
                    {pendingLeaveCount}
                  </span>
                ) : null}
              </div>
            </div>
          );

          if (isDisabled) {
            return <div key={card.id}>{content}</div>;
          }
          return (
            <Link key={card.id} to={card.path} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
