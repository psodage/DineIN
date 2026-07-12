import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Spinner from "@/components/ui/Spinner";

export default function AuthRedirect() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    const isAdmin =
      isAuthenticated &&
      (!user?.role || String(user.role).toLowerCase() === "admin");
    navigate(isAdmin ? "/dashboard" : "/login", { replace: true });
  }, [loading, isAuthenticated, user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Spinner />
    </div>
  );
}
