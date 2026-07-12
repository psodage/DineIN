import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import LanguageToggle from "../components/LanguageToggle";

export default function SplashPage() {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate(isAuthenticated ? "/dashboard" : "/welcome", { replace: true });
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-brand/10 via-white to-accent/10">
      <LanguageToggle className="absolute right-4 top-4 safe-top" />
      <img src="/logo2.png" alt="DineIN" className="h-24 w-auto animate-fade-in" />
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">DineIN Member</h1>
      <p className="mt-2 text-sm text-muted">Eat Smart. Live Easy.</p>
      <LoadingOverlay visible color="#0F8F88" />
    </div>
  );
}
