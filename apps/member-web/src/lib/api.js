import axios from "axios";
import { API_BASE_URL } from "../config";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let onAuthError = null;
let memoryToken = null;
let suppressAuthErrorUntilTs = 0;

export function setOnAuthError(handler) {
  onAuthError = typeof handler === "function" ? handler : null;
}

export function setAuthToken(token) {
  memoryToken = token ? String(token) : null;
}

export function suppressAuthErrorFor(ms = 2500) {
  const duration = Number(ms);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 2500;
  suppressAuthErrorUntilTs = Date.now() + safeDuration;
}

function getStoredToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    /* ignore */
  }
}

api.interceptors.request.use(
  (config) => {
    const token = memoryToken || getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const shouldSuppress =
        Date.now() < suppressAuthErrorUntilTs || err?.config?.skipAuthErrorHandling === true;

      const message = err?.response?.data?.message;
      const sessionExpiredMsg = "Session expired. You have logged in on another device.";

      memoryToken = null;
      clearStoredAuth();

      if (!shouldSuppress) {
        try {
          const type = message === sessionExpiredMsg ? "SESSION_EXPIRED" : "AUTH_ERROR";
          await onAuthError?.({ type, message });
        } catch {
          /* ignore */
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
