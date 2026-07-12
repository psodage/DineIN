import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Lock } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useLanguage } from "../../context/LanguageContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const { t } = useLanguage();
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const verifyOtp = async () => {
    if (!email) {
      setModal({ title: t("alert_error"), body: t("reset_email_missing") });
      return;
    }
    if (!otp.trim()) {
      setModal({ title: t("alert_error"), body: t("reset_otp_missing") });
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/member-verify-otp`, { email, otp: otp.trim() });
      setOtpVerified(true);
      setModal({ title: t("alert_success"), body: t("otp_verify_success") });
    } catch (err) {
      setModal({ title: t("alert_error"), body: err?.response?.data?.message || "OTP verification failed." });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setModal({ title: t("alert_error"), body: t("reset_passwords_missing") });
      return;
    }
    if (password !== confirm) {
      setModal({ title: t("alert_error"), body: t("reset_passwords_mismatch") });
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/member-reset-password`, {
        email,
        otp: otp.trim(),
        newPassword: password,
      });
      setModal({
        title: t("alert_success"),
        body: t("reset_success"),
        onClose: () => navigate("/login", { replace: true }),
      });
    } catch (err) {
      setModal({ title: t("alert_error"), body: err?.response?.data?.message || t("reset_failed_generic") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <PageHeader title={t("reset_title")} backTo="/login" />
      <div className="px-5 py-6">
        <p className="text-sm text-muted">
          {t("reset_subtitle_prefix")} <strong>{email}</strong> {t("reset_subtitle_suffix")}
        </p>

        {!otpVerified ? (
          <div className="mt-6 space-y-4">
            <Input placeholder={t("otp_placeholder")} value={otp} onChange={(e) => setOtp(e.target.value)} />
            <Button className="w-full" onClick={verifyOtp} loading={loading}>
              {t("verify_otp_button")}
            </Button>
          </div>
        ) : (
          <form onSubmit={resetPassword} className="mt-6 space-y-4">
            <Input icon={Lock} type="password" placeholder={t("new_password_placeholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input icon={Lock} type="password" placeholder={t("confirm_new_password_placeholder")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="submit" variant="accent" className="w-full" loading={loading}>
              Reset password
            </Button>
          </form>
        )}
      </div>
      <Modal open={!!modal} title={modal?.title} onClose={() => { modal?.onClose?.(); setModal(null); }}>
        {modal?.body}
      </Modal>
    </div>
  );
}
