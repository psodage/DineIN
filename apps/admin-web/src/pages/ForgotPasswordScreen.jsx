import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { Alert } from "@/utils/dialog";
import Spinner from "@/components/ui/Spinner";

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      Alert.alert(t("alert_error"), t("forgot_missing_email"));
      return;
    }

    try {
      setLoading(true);
      const base = API_BASE_URL || "";
      const res = await axios.post(`${base}/api/auth/send-otp`, { email });
      if (res.status >= 200 && res.status < 300) {
        Alert.alert(t("alert_success"), t("forgot_success"), [
          {
            text: "OK",
            onPress: () =>
              navigate("/reset-password", { state: { email } }),
          },
        ]);
      }
    } catch (err) {
      let msg = err.response?.data?.message || err.message || t("forgot_failed_generic");
      if (msg === "User not found") msg = t("forgot_user_not_found");
      if (err.response?.status === 429) msg = t("otp_rate_limit");
      if (err.request && !err.response) msg = "Cannot reach server. Check that the backend is running.";
      Alert.alert(t("alert_error"), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <LanguageToggle />
        </div>
        <div className="card-panel">
          <h1 className="text-2xl font-bold text-slate-900">{t("forgot_title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("forgot_subtitle")}</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">{t("email_label")}</label>
              <input
                type="email"
                className="input-field"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="h-5 w-5 border-white/30 border-t-white" label="" /> : t("forgot_button")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
