import axios from "axios";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: { "Content-Type": "application/json" },
});

let onAuthError = null;

export function setOnAuthError(handler) {
  onAuthError = typeof handler === "function" ? handler : null;
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
    // ignore
  }
}

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
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
      const message = err?.response?.data?.message;
      const sessionExpiredMsg =
        "Session expired. You have logged in on another device.";

      clearStoredAuth();

      try {
        const type =
          message === sessionExpiredMsg ? "SESSION_EXPIRED" : "AUTH_ERROR";
        await onAuthError?.({ type, message });
      } catch {
        // ignore
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export async function runBackupNow() {
  const res = await api.post("/api/backups/run");
  return res?.data;
}

export async function listBackupFiles() {
  const res = await api.get("/api/backups/files");
  return Array.isArray(res?.data?.files) ? res.data.files : [];
}

export async function restoreBackupByFile(fileName, confirmPhrase) {
  const res = await api.post("/api/backups/restore", { fileName, confirmPhrase });
  return res?.data;
}

export async function restoreLatestBackup(confirmPhrase) {
  const res = await api.post("/api/backups/restore-latest", { confirmPhrase });
  return res?.data;
}
