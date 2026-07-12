import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import AppSecurityWrapper from "./components/AppSecurityWrapper";
import LoadingOverlay from "./components/ui/LoadingOverlay";
import Modal from "./components/ui/Modal";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition, { AnimatedPage } from "./components/ui/PageTransition";
import MobileOnly from "./components/MobileOnly";
import useMobileCheck from "./hooks/useMobileCheck";

import SplashPage from "./pages/SplashPage";
import WelcomePage from "./pages/WelcomePage";
import LoginEmailPage from "./pages/auth/LoginEmailPage";
import LoginPhonePage from "./pages/auth/LoginPhonePage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";
import DashboardPage from "./pages/DashboardPage";
import EditProfilePage from "./pages/profile/EditProfilePage";
import PaymentHistoryPage from "./pages/bill/PaymentHistoryPage";
import LeaveHistoryPage from "./pages/leave/LeaveHistoryPage";
import SnackOrderHistoryPage from "./pages/snacks/SnackOrderHistoryPage";
import SnackPurchaseSuccessPage from "./pages/snacks/SnackPurchaseSuccessPage";
import SnackSplitSuccessPage from "./pages/snacks/SnackSplitSuccessPage";
import ActivityCalendarPage from "./pages/ActivityCalendarPage";

function AuthAlertModal() {
  const { authAlert, dismissAuthAlert } = useAuth();
  return (
    <Modal open={!!authAlert} title={authAlert?.title} onClose={dismissAuthAlert}>
      {authAlert?.message}
    </Modal>
  );
}

function AppRoutes() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <LoadingOverlay visible />
      </div>
    );
  }

  return (
    <>
      <PageTransition />
      <AnimatedPage>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <SplashPage />
            }
          />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginEmailPage />} />
          <Route path="/login/phone" element={<LoginPhonePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bill/payments"
            element={
              <ProtectedRoute>
                <PaymentHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaves/history"
            element={
              <ProtectedRoute>
                <LeaveHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/snacks/history"
            element={
              <ProtectedRoute>
                <SnackOrderHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/snacks/success"
            element={
              <ProtectedRoute>
                <SnackPurchaseSuccessPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/snacks/split-success"
            element={
              <ProtectedRoute>
                <SnackSplitSuccessPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity-calendar"
            element={
              <ProtectedRoute>
                <ActivityCalendarPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatedPage>
    </>
  );
}

/** Authenticated app shell — only mounted when mobile access is granted. */
function MobileApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppSecurityWrapper>
          <div className="mx-auto min-h-dvh max-w-lg bg-surface shadow-2xl shadow-slate-900/5">
            <AppRoutes />
            <AuthAlertModal />
          </div>
        </AppSecurityWrapper>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default function App() {
  const mobileCheck = useMobileCheck();

  // Gate runs before any providers, routes, or protected pages mount.
  if (!mobileCheck.isAllowed) {
    return <MobileOnly {...mobileCheck} />;
  }

  return <MobileApp />;
}
