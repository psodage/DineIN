import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { API_BASE_URL } from "../config";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let onAuthError = null;
let memoryToken = null;
let suppressAuthErrorUntilTs = 0;

function buildFallbackBaseUrls(baseURL) {
  const primary = String(baseURL || "").trim();
  if (!primary) return [];

  const candidates = [primary];
  // On Android, requests often fail when the API points at a host-only address
  // (e.g. a LAN IP from a different network, or localhost from a device context).
  // Keep fallbacks enabled even for production builds, since the configured baseURL
  // may still target a dev/staging server reachable only via emulator/host mapping.
  if (Platform.OS !== "android") return candidates;

  try {
    const parsed = new URL(primary);
    const isPrivateIpv4 =
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(parsed.hostname);
    const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    // Android emulator can reach the host machine via 10.0.2.2
    // (maps to the host loopback interface).
    if (isLoopback || isPrivateIpv4) {
      const emulatorUrl = `${parsed.protocol}//10.0.2.2${parsed.port ? `:${parsed.port}` : ""}`;
      candidates.push(emulatorUrl);
    }

    // Do not add localhost fallback on Android.
    // On emulator/device, localhost points to the Android runtime itself, not host machine.
  } catch {
    // Ignore malformed URLs and keep the primary base URL only.
  }

  return [...new Set(candidates)];
}

export function setOnAuthError(handler) {
  onAuthError = typeof handler === "function" ? handler : null;
}

/**
 * Sets/clears an in-memory token used for Authorization headers.
 * This enables "non-remembered" sessions (not persisted to AsyncStorage).
 */
export function setAuthToken(token) {
  memoryToken = token ? String(token) : null;
}

/**
 * Temporarily suppress global auth-error callback (used during explicit logout).
 */
export function suppressAuthErrorFor(ms = 2500) {
  const duration = Number(ms);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 2500;
  suppressAuthErrorUntilTs = Date.now() + safeDuration;
}

api.interceptors.request.use(
  async (config) => {
    const token = memoryToken || (await AsyncStorage.getItem("token"));
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const fallbackBaseUrls = buildFallbackBaseUrls(config.baseURL || API_BASE_URL);
    config.baseURL = fallbackBaseUrls[0] || config.baseURL;
    config._fallbackBaseUrls = fallbackBaseUrls;
    config._fallbackAttempt = config._fallbackAttempt || 0;

    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // In React Native, Axios often surfaces unreachable hosts as a generic "Network Error"
    // with no `response`. Log the resolved URL so we can diagnose baseURL issues quickly.
    if (!err.response && err.config) {
      try {
        const baseURL = err.config.baseURL || API_BASE_URL;
        const url = err.config.url || "";
        const method = String(err.config.method || "get").toUpperCase();
        const fallbackBaseUrls = Array.isArray(err.config._fallbackBaseUrls)
          ? err.config._fallbackBaseUrls
          : buildFallbackBaseUrls(baseURL);
        const attempt = Number(err.config._fallbackAttempt || 0);
        const attempted = fallbackBaseUrls[attempt] || baseURL;
        const joined = attempted
          ? `${String(attempted).replace(/\/+$/, "")}/${String(url).replace(/^\/+/, "")}`
          : url;

        console.warn(
          `[API] Network error (${method}) ${joined} (attempt ${attempt + 1}/${fallbackBaseUrls.length || 1})`
        );
      } catch (_) {
        // ignore
      }
    }

    if (!err.response && err.config) {
      const fallbackBaseUrls = Array.isArray(err.config._fallbackBaseUrls)
        ? err.config._fallbackBaseUrls
        : buildFallbackBaseUrls(err.config.baseURL || API_BASE_URL);
      const nextAttempt = Number(err.config._fallbackAttempt || 0) + 1;
      const nextBaseURL = fallbackBaseUrls[nextAttempt];

      if (nextBaseURL) {
        console.warn(`[API] Retrying via ${nextBaseURL}`);
        err.config._fallbackAttempt = nextAttempt;
        err.config.baseURL = nextBaseURL;
        return api.request(err.config);
      }
    }

    if (err.response?.status === 401) {
      const shouldSuppressAuthError =
        Date.now() < suppressAuthErrorUntilTs || err?.config?.skipAuthErrorHandling === true;

      const message = err?.response?.data?.message;
      const sessionExpiredMsg =
        "Session expired. You have logged in on another device.";

      memoryToken = null;
      await AsyncStorage.multiRemove(["token", "user"]);

      // Avoid showing "Authentication required" when logout is user-initiated.
      if (!shouldSuppressAuthError) {
        try {
          const type =
            message === sessionExpiredMsg ? "SESSION_EXPIRED" : "AUTH_ERROR";
          await onAuthError?.({ type, message });
        } catch (_) {
          // ignore
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
