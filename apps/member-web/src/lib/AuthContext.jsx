import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken, setOnAuthError, suppressAuthErrorFor } from "./api";
import api from "./api";

function normalizeStoredUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const u = { ...raw };
  if (u.id == null && u._id != null) u.id = String(u._id);
  return u;
}

const AuthContext = createContext({
  token: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authAlert, setAuthAlert] = useState(null);

  const loadAuth = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      setAuthToken(storedToken);
      setToken(storedToken);
      setUser(storedUser ? normalizeStoredUser(JSON.parse(storedUser)) : null);
    } catch {
      setAuthToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    setOnAuthError(async (evt) => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setAuthToken(null);
      setToken(null);
      setUser(null);
      const message = evt?.message || "Session expired. Please log in again.";
      setAuthAlert({ title: "Authentication required", message });
      navigate("/", { replace: true });
    });
    return () => setOnAuthError(null);
  }, [navigate]);

  const login = async (newToken, newUser, options = {}) => {
    const remember = options?.remember === true;
    const normalized = normalizeStoredUser(newUser);
    setAuthToken(newToken);
    if (remember) {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(normalized || newUser));
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    setToken(newToken);
    setUser(normalized || newUser);
  };

  const logout = async () => {
    try {
      suppressAuthErrorFor(4000);
      if (token) {
        await api.post("/api/auth/member-logout", {}, { skipAuthErrorHandling: true });
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const dismissAuthAlert = () => setAuthAlert(null);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: !!token,
        login,
        logout,
        loadAuth,
        authAlert,
        dismissAuthAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
