import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { useLanguage } from "../../context/LanguageContext";
import SignupLayout from "./SignupLayout";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import LoadingOverlay from "../../components/ui/LoadingOverlay";
import Modal from "../../components/ui/Modal";
import { Mail, Phone, User, Lock } from "lucide-react";

const MEAL_PLANS = ["Lunch", "Dinner", "Both"];

function clean(v) {
  return String(v ?? "").trim();
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: "",
    roomOwnerName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    mealPlan: "Lunch",
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    const payload = {
      name: clean(form.name),
      roomOwnerName: clean(form.roomOwnerName),
      phone: clean(form.phone),
      email: clean(form.email).toLowerCase(),
      password: clean(form.password),
      mealPlan: form.mealPlan,
    };
    const phoneDigits = payload.phone.replace(/\D/g, "");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);

    if (!payload.name || !payload.roomOwnerName || !payload.phone || !payload.email || !payload.password) {
      setModal({ title: t("alert_error"), body: "Please fill all required fields." });
      return;
    }
    if (!emailOk) {
      setModal({ title: t("alert_error"), body: t("manage_members_validation_email") });
      return;
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setModal({ title: t("alert_error"), body: t("manage_members_validation_phone") });
      return;
    }
    if (payload.password.length < 6) {
      setModal({ title: t("alert_error"), body: "Password must be at least 6 characters." });
      return;
    }
    if (payload.password !== clean(form.confirmPassword)) {
      setModal({ title: t("alert_error"), body: t("reset_passwords_mismatch") });
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/pending-registrations`, payload);
      setModal({
        title: t("alert_success"),
        body: "Registration submitted. Admin approval is required before you can sign in.",
        onClose: () => navigate("/login", { replace: true }),
      });
    } catch (err) {
      setModal({
        title: t("alert_error"),
        body: err?.response?.data?.message || "Signup failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignupLayout>
      <h2 className="text-center text-2xl font-extrabold text-ink">Create account</h2>
      <p className="mt-2 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Sign In
        </Link>
      </p>

      <form onSubmit={handleSignup} className="mt-5 max-h-[80vh] space-y-3 overflow-y-auto pr-1">
        <Input icon={User} placeholder="Full name" value={form.name} onChange={set("name")} className="!min-h-[44px] !rounded-xl text-sm" />
        <Input icon={User} placeholder="Room owner name" value={form.roomOwnerName} onChange={set("roomOwnerName")} className="!min-h-[44px] !rounded-xl text-sm" />
        <Input icon={Phone} placeholder="Phone" value={form.phone} onChange={set("phone")} className="!min-h-[44px] !rounded-xl text-sm" />
        <Input icon={Mail} type="email" placeholder="Email" value={form.email} onChange={set("email")} className="!min-h-[44px] !rounded-xl text-sm" />
        <Input icon={Lock} type="password" placeholder="Password" value={form.password} onChange={set("password")} className="!min-h-[44px] !rounded-xl text-sm" />
        <Input icon={Lock} type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={set("confirmPassword")} className="!min-h-[44px] !rounded-xl text-sm" />

        <div>
          <p className="mb-2 text-xs font-semibold text-ink">Meal plan</p>
          <div className="flex gap-2">
            {MEAL_PLANS.map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => setForm((f) => ({ ...f, mealPlan: plan }))}
                className={`flex-1 py-2 text-xs font-bold border border-orange-500 rounded-xl transition-colors duration-200 ${form.mealPlan === plan
                    ? "bg-orange-500 text-white"
                    : "bg-white text-orange-500 hover:bg-orange-500 hover:text-white"
                  }`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="accent" className="w-full sticky bottom-0 mt-4 !min-h-[44px] !rounded-xl text-sm" loading={loading}>
          Create account
        </Button>
      </form>

      <LoadingOverlay visible={loading} />
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
    </SignupLayout>
  );
}
