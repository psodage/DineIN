import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import LoadingOverlay from "./ui/LoadingOverlay";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingOverlay visible />;
  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }
  return children;
}
