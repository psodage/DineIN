import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, Mail, Phone } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import AuthLayout from "./AuthLayout";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import LoadingOverlay from "../../components/ui/LoadingOverlay";
import Modal from "../../components/ui/Modal";

export default function LoginEmailPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) {
      setModal({
        title: t("alert_error"),
        body: t("member_login_missing_fields"),
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/auth/member-login`, {
        email: cleanEmail,
        password: cleanPassword,
      });
      await login(res.data.token, res.data.user, { remember: rememberMe });
      setModal({
        title: t("alert_success"),
        body: t("login_success"),
        type: "success",
        onClose: () => navigate("/dashboard", { replace: true }),
      });
    } catch (err) {
      setModal({
        title: t("alert_error"),
        body: err?.response?.data?.message || t("member_login_failed_generic"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout headline="Log in to stay on top of your meals and orders.">
      <h2 className="text-center text-2xl font-extrabold text-ink">{t("login_title")}</h2>
      <p className="mt-2 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          Sign Up
        </Link>
      </p>

      <form onSubmit={handleLogin} className="mt-6 space-y-3.5">
        <Input
          icon={Mail}
          type="email"
          placeholder={t("email_placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-slate-100 px-4">
          <Lock className="h-5 w-5 text-slate-500" />
          <input
            type={showPassword ? "text" : "password"}
            className="w-full bg-transparent text-[15px] outline-none"
            placeholder={t("password_placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-slate-500">
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <div className={`h-[18px] w-[18px] rounded border-2 transition-all flex items-center justify-center ${
                rememberMe
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}>
                {rememberMe && (
                  <svg className="h-3 w-3 stroke-current stroke-[3.5px]" fill="none" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            Remember me
          </label>
        </div>

        <Button type="submit" variant="accent" className="w-full" loading={loading}>
          {t("login_title")}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => navigate("/login/phone")}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-200"
      >
        <Phone className="h-5 w-5 text-accent" />
        <span className="flex-1 text-sm font-semibold text-ink">Continue with phone number</span>
        <span className="text-slate-400">›</span>
      </button>

      <LoadingOverlay visible={loading} color="#F97316" />
      <Modal
        open={!!modal}
        title={modal?.title}
        onClose={() => {
          modal?.onClose?.();
          setModal(null);
        }}
      >
        {modal?.body}
      </Modal>
    </AuthLayout>
  );
}
