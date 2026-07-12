import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function AuthErrorBanner() {
  const { authError, clearAuthError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authError) return;
    const t = setTimeout(() => {
      clearAuthError();
      navigate("/login", { replace: true });
    }, 100);
    return () => clearTimeout(t);
  }, [authError, clearAuthError, navigate]);

  if (!authError) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[10001] bg-red-600 px-4 py-3 text-center text-sm font-medium text-white safe-top">
      {authError}
    </div>
  );
}
