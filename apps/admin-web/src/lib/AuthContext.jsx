import React, { createContext, useContext, useState, useEffect } from "react";
import { setOnAuthError } from "./api";
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
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadAuth = async () => {
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      setToken(storedToken);
      setUser(
        storedUser ? normalizeStoredUser(JSON.parse(storedUser)) : null
      );
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    setOnAuthError(async (evt) => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setUser(null);
      setAuthError(
        evt?.message || "Session expired. Please log in again."
      );
    });
    return () => setOnAuthError(null);
  }, []);

  const login = async (newToken, newUser) => {
    const normalized = normalizeStoredUser(newUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(normalized || newUser));
    setToken(newToken);
    setUser(normalized || newUser);
    setAuthError(null);
  };

  const logout = async () => {
    try {
      if (token && user?.role === "member") {
        await api.post("/api/auth/member-logout");
      }
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const clearAuthError = () => setAuthError(null);

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
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
