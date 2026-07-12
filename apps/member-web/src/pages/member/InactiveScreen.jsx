import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import LoadingOverlay from "../../components/ui/LoadingOverlay";
import Modal from "../../components/ui/Modal";

export default function InactiveScreen({ memberId, onRefreshStatus }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaveInfo, setLeaveInfo] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get(`/api/leave/student/${memberId}`);
        if (mounted) setLeaveInfo(res?.data);
      } catch {
        if (mounted) setLeaveInfo(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const requestReactivation = async () => {
    try {
      setSubmitting(true);
      await api.post("/api/leave/apply", {
        memberId,
        reason: "Reactivation request from inactive member",
        type: "reactivation",
      });
      setModal({
        title: "Request sent",
        body: "Your reactivation request has been submitted for admin review.",
      });
      await onRefreshStatus?.();
    } catch (err) {
      setModal({
        title: "Error",
        body: err?.response?.data?.message || "Failed to submit request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingOverlay visible />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="max-w-sm rounded-3xl bg-white p-8 shadow-xl animate-slide-up">
        <p className="text-5xl">⏸️</p>
        <h1 className="mt-4 text-2xl font-extrabold text-ink">Account inactive</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your membership is currently inactive. Request reactivation or contact your mess admin.
        </p>
        {leaveInfo?.status ? (
          <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            Leave status: {leaveInfo.status}
          </p>
        ) : null}
        <Button className="mt-6 w-full" loading={submitting} onClick={requestReactivation}>
          Request reactivation
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate("/", { replace: true })}>
          Back to sign in
        </Button>
      </div>
      <Modal open={!!modal} title={modal?.title} onClose={() => setModal(null)}>
        {modal?.body}
      </Modal>
    </div>
  );
}
