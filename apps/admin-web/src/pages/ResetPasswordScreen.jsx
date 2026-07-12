import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { Alert } from "@/utils/dialog";
import Spinner from "@/components/ui/Spinner";

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const { t } = useLanguage();

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const handleVerifyOtp = async () => {
    if (!email || !otp) {
      Alert.alert(t("alert_error"), t("reset_otp_missing"));
      return;
    }
    try {
      setLoading(true);
      const base = API_BASE_URL || "";
      await axios.post(`${base}/api/auth/verify-otp`, { email, otp });
      setOtpVerified(true);
      Alert.alert(t("alert_success"), t("otp_verify_success"));
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("reset_failed_generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      Alert.alert("Error", t("reset_email_missing"));
      return;
    }
    if (!otp) {
      Alert.alert(t("alert_error"), t("reset_otp_missing"));
      return;
    }
    if (!password || !confirmPassword) {
      Alert.alert(t("alert_error"), t("reset_passwords_missing"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("alert_error"), t("reset_passwords_mismatch"));
      return;
    }

    try {
      setLoading(true);
      const base = API_BASE_URL || "";
      await axios.post(`${base}/api/auth/reset-password`, {
        email,
        otp,
        newPassword: password,
      });
      Alert.alert(t("alert_success"), t("reset_success"), [
        { text: "OK", onPress: () => navigate("/login", { replace: true }) },
      ]);
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("reset_failed_generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <LanguageToggle />
        </div>
        <div className="card-panel">
          <h1 className="text-2xl font-bold">{t("reset_title")}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("reset_subtitle_prefix")} {email} {t("reset_subtitle_suffix")}
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("otp_label")}</label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder={t("otp_placeholder")}
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  disabled={otpVerified}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setOtpVerified(false);
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || !otp || otp.length !== 6 || otpVerified}
                  className={`shrink-0 rounded-xl px-4 text-sm font-semibold text-white ${
                    otpVerified ? "bg-emerald-600" : "bg-slate-700"
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
                  ) : otpVerified ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    t("verify_otp_button")
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("new_password_label")}</label>
              <input
                type="password"
                className="input-field disabled:bg-slate-100"
                disabled={!otpVerified}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("confirm_new_password_label")}</label>
              <input
                type="password"
                className="input-field disabled:bg-slate-100"
                disabled={!otpVerified}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={!otpVerified || loading}>
              {loading ? <Spinner className="h-5 w-5 border-white/30 border-t-white" label="" /> : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
