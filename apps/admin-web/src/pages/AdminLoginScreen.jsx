import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { Alert } from "@/utils/dialog";
import logo from "@/assets/logo2.png";
import Spinner from "@/components/ui/Spinner";

export default function AdminLoginScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { login, loadAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      Alert.alert(t("alert_error"), t("login_missing_fields"));
      return;
    }

    try {
      setLoading(true);
      const base = API_BASE_URL || "";
      const res = await axios.post(
        `${base}/api/auth/login`,
        { email, password },
        { timeout: 15000 }
      );
      await login(res.data.token, res.data.user);
      await loadAuth();
      navigate("/dashboard", { replace: true });
      Alert.alert(t("alert_success"), t("login_success"));
    } catch (err) {
      let msg = err?.response?.data?.message;
      if (!msg && !err?.response) {
        const port = (() => {
          try {
            return new URL(API_BASE_URL || "http://localhost:5000").port || "5000";
          } catch {
            return "5000";
          }
        })();
        msg =
          err?.code === "ECONNABORTED"
            ? `Request timed out.\n\nBackend: ${API_BASE_URL || "proxy"}\n\nEnsure npm run dev is running in backend/ and firewall allows port ${port}.`
            : `Cannot reach the server.\n\n• Set VITE_API_BASE_URL in frontend/.env\n• Start backend on port ${port}\n• Restart dev server after .env changes`;
      }
      if (!msg) msg = t("login_failed_generic");
      Alert.alert(t("alert_error"), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between p-10 text-white lg:flex">
        <div className="flex items-center gap-4">
          <img src={logo} alt="DineIN" className="h-14 w-14 rounded-2xl bg-white p-2 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">DineIN</h1>
            <p className="text-sm text-brand-200">{t("admin_brand_meta")}</p>
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">DineIN Admin</h2>
          <p className="mt-4 max-w-md text-lg text-slate-300">
            Manage members, payments, expenses, and reports from one modern dashboard.
          </p>
        </div>
        <p className="text-sm text-slate-500">© DineIN — Restaurant management</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mb-6 flex justify-end lg:absolute lg:right-6 lg:top-6">
          <LanguageToggle />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="" className="h-12 w-12 rounded-xl bg-white p-1.5" />
            <div>
              <p className="font-bold text-slate-900">DineIN</p>
              <p className="text-xs text-slate-500">{t("admin_brand_meta")}</p>
            </div>
          </div>

          <div className="card-panel">
            <h2 className="text-2xl font-bold text-slate-900">{t("admin_login_title")}</h2>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  {t("email_label")}
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder={t("email_placeholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  {t("password_label")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field pr-11"
                    placeholder={t("password_placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Spinner className="h-5 w-5 border-white/30 border-t-white" label="" /> : t("Sign In")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              {t("footer_forgot_prefix")}{" "}
              <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline">
                {t("footer_forgot_link")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
