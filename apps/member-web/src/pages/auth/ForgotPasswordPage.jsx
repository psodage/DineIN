import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mail } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useLanguage } from "../../context/LanguageContext";
import AuthLayout from "./AuthLayout";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setModal({ title: t("alert_error"), body: t("forgot_missing_email") });
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/member-send-otp`, { email: cleanEmail });
      setModal({
        title: t("alert_success"),
        body: t("forgot_success"),
        onClose: () =>
          navigate(`/reset-password?email=${encodeURIComponent(cleanEmail)}`, { replace: true }),
      });
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 404
          ? t("member_forgot_user_not_found")
          : status === 429
            ? t("otp_rate_limit")
            : err?.response?.data?.message || t("forgot_failed_generic");
      setModal({ title: t("alert_error"), body: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <PageHeader title={t("forgot_title")} backTo="/login" />
      <div className="px-5 py-6">
        <p className="text-sm leading-relaxed text-muted">{t("forgot_subtitle")}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input icon={Mail} type="email" placeholder={t("email_placeholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="accent" className="w-full" loading={loading}>
            {t("forgot_button")}
          </Button>
        </form>
      </div>
      <Modal open={!!modal} title={modal?.title} onClose={() => { modal?.onClose?.(); setModal(null); }}>
        {modal?.body}
      </Modal>
    </div>
  );
}
