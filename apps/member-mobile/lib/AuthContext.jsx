import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { router } from "expo-router";
import { setAuthToken, setOnAuthError, suppressAuthErrorFor } from "./api";
import api from "./api";

/** Ensure member screens can rely on `user.id` (some stored payloads only had `_id`). */
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

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem("token"),
        AsyncStorage.getItem("user"),
      ]);
      setAuthToken(storedToken);
      setToken(storedToken);
      setUser(storedUser ? normalizeStoredUser(JSON.parse(storedUser)) : null);
    } catch (e) {
      setAuthToken(null);
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
      // On any 401, clear in-memory auth state too (not only AsyncStorage)
      // so the UI stops calling protected endpoints with a stale token.
      await AsyncStorage.multiRemove(["token", "user"]);
      setAuthToken(null);
      setToken(null);
      setUser(null);

      const message = evt?.message || "Session expired. Please log in again.";
      Alert.alert("Authentication required", message);
      router.replace("/");
    });
    return () => setOnAuthError(null);
  }, []);

  /**
   * Log in the user.
   * If `remember` is false, auth is kept in-memory only (not persisted).
   */
  const login = async (newToken, newUser, options = {}) => {
    const remember = options?.remember === true;
    const normalized = normalizeStoredUser(newUser);
    setAuthToken(newToken);
    if (remember) {
      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(normalized || newUser));
    } else {
      // Ensure any previous remembered session is cleared.
      await AsyncStorage.multiRemove(["token", "user"]);
    }
    setToken(newToken);
    setUser(normalized || newUser);
  };

  const logout = async () => {
    try {
      // Suppress global 401 alert while user explicitly logs out.
      suppressAuthErrorFor(4000);
      // Best-effort server-side logout (clears activeSessionToken).
      if (token) {
        await api.post("/api/auth/member-logout", {}, {
          skipAuthErrorHandling: true,
        });
      }
    } catch (_) {
      // ignore
    }
    await AsyncStorage.multiRemove(["token", "user"]);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
