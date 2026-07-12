import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "@/lib/config";
import { Alert } from "@/utils/dialog";
import logo from "@/assets/logo2.png";
import Spinner from "@/components/ui/Spinner";

export default function AdminSignupScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      const base = API_BASE_URL || "";
      await axios.post(`${base}/api/auth/register`, { email, password });
      Alert.alert("Success", "Admin registered successfully", [
        { text: "OK", onPress: () => navigate("/login") },
      ]);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="card-panel w-full max-w-md">
        <img src={logo} alt="DineIN" className="mb-6 h-16 w-auto object-contain" />
        <h1 className="text-2xl font-bold">Admin Sign Up</h1>
        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Confirm Password</label>
            <input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-5 w-5 border-white/30 border-t-white" label="" /> : "Create Admin Account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
