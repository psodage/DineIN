import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import BottomNav from "../components/layout/BottomNav";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import HomeTab from "../components/dashboard/HomeTab";
import SnacksTab from "./snacks/SnacksTab";
import BillTab from "./bill/BillTab";
import ProfileTab from "./profile/ProfileTab";
import LeaveTab from "./leave/LeaveTab";
import InactiveScreen from "./member/InactiveScreen";

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "home";
  const [activeTab, setActiveTab] = useState(tabParam);
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const [memberStatus, setMemberStatus] = useState(String(user?.status || "").trim().toLowerCase());
  const [statusLoading, setStatusLoading] = useState(true);

  const memberId = user?.id || user?._id;
  const isInactive = memberStatus === "inactive";

  const fetchMemberStatus = useCallback(async () => {
    if (!memberId) {
      setStatusLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/members/${memberId}`);
      setMemberStatus(String(res?.data?.status || user?.status || "").trim().toLowerCase());
    } catch {
      setMemberStatus(String(user?.status || "").trim().toLowerCase());
    } finally {
      setStatusLoading(false);
    }
  }, [memberId, user?.status]);

  useEffect(() => {
    fetchMemberStatus();
  }, [fetchMemberStatus]);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const goTab = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
    if (key === "home") setPollRefreshKey((k) => k + 1);
  };

  if (statusLoading) {
    return (
      <div className="min-h-dvh bg-surface">
        <LoadingOverlay visible />
      </div>
    );
  }

  if (isInactive) {
    return <InactiveScreen memberId={memberId} onRefreshStatus={fetchMemberStatus} />;
  }

  let content = <HomeTab pollRefreshKey={pollRefreshKey} />;
  if (activeTab === "snacks") content = <SnacksTab />;
  if (activeTab === "leaves") content = <LeaveTab />;
  if (activeTab === "bill") content = <BillTab />;
  if (activeTab === "profile") content = <ProfileTab onTabChange={goTab} />;

  return (
    <div className="min-h-dvh bg-white">
      {content}
      <BottomNav activeTab={activeTab} onTabChange={goTab} />
    </div>
  );
}
