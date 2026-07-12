import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import api from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirm) {
      setModal({ title: t("alert_error"), body: t("reset_passwords_missing") });
      return;
    }
    if (newPassword !== confirm) {
      setModal({ title: t("alert_error"), body: t("reset_passwords_mismatch") });
      return;
    }
    try {
      setLoading(true);
      await api.post("/api/auth/member-change-password", { currentPassword, newPassword });
      setModal({
        title: t("alert_success"),
        body: "Password changed successfully.",
        onClose: () => navigate(-1),
      });
    } catch (err) {
      setModal({ title: t("alert_error"), body: err?.response?.data?.message || "Failed to change password." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white pb-6">
      <PageHeader title="Change password" backTo="/dashboard" />
      <div className="px-4 py-4">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-surface p-5 space-y-4">
          <Input icon={Lock} type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          <Input icon={Lock} type="password" placeholder={t("new_password_placeholder")} value={newPassword} onChange={(e) => setNew(e.target.value)} />
          <Input icon={Lock} type="password" placeholder={t("confirm_new_password_placeholder")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button variant="accent" type="submit" className="w-full mt-2" loading={loading}>
            Save password
          </Button>
        </form>
      </div>
      <Modal open={!!modal} title={modal?.title} onClose={() => { modal?.onClose?.(); setModal(null); }}>
        {modal?.body}
      </Modal>
    </div>
  );
}
