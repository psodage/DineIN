import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AppSecurityWrapper from "@/components/AppSecurityWrapper";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/layout/AdminLayout";
import AuthRedirect from "@/pages/AuthRedirect";
import AdminLoginScreen from "@/pages/AdminLoginScreen";
import AdminSignupScreen from "@/pages/AdminSignupScreen";
import ForgotPasswordScreen from "@/pages/ForgotPasswordScreen";
import ResetPasswordScreen from "@/pages/ResetPasswordScreen";
import AdminDashboard from "@/pages/AdminDashboard";
import ManageMembers from "@/pages/ManageMembers";
import MemberDetails from "@/pages/MemberDetails";
import MembersApproval from "@/pages/MembersApproval";
import ManageMenu from "@/pages/ManageMenu";
import MessExpenses from "@/pages/MessExpenses";
import ExtraSnacks from "@/pages/ExtraSnacks";
import ManageExtraSnacks from "@/pages/ManageExtraSnacks";
import Payments from "@/pages/Payments";
import RemainingMembers from "@/pages/RemainingMembers";
import MembersPaid from "@/pages/MembersPaid";
import Reports from "@/pages/Reports";
import LeaveApproval from "@/pages/LeaveApproval";
import BackupManagement from "@/pages/BackupManagement";
import SnackQrScanner from "@/pages/SnackQrScanner";
import AuthErrorBanner from "@/components/AuthErrorBanner";

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppSecurityWrapper>
          <AuthErrorBanner />
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            <Route path="/login" element={<AdminLoginScreen />} />
            <Route path="/signup" element={<AdminSignupScreen />} />
            <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />

            <Route
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/members" element={<ManageMembers />} />
              <Route path="/members/:memberId" element={<MemberDetails />} />
              <Route path="/members-approval" element={<MembersApproval />} />
              <Route path="/manage-menu" element={<ManageMenu />} />
              <Route path="/mess-expenses" element={<MessExpenses />} />
              <Route path="/extra-snacks" element={<ExtraSnacks />} />
              <Route path="/manage-extra-snacks" element={<ManageExtraSnacks />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payments/remaining" element={<RemainingMembers />} />
              <Route path="/payments/paid" element={<MembersPaid />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/leave-approval" element={<LeaveApproval />} />
              <Route path="/backups" element={<BackupManagement />} />
              <Route path="/qr-scanner" element={<SnackQrScanner />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppSecurityWrapper>
      </LanguageProvider>
    </AuthProvider>
  );
}
