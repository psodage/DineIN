import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 5000;

/**
 * Metro / Expo exposes the dev machine as `host:port` (e.g. 192.168.1.5:8081).
 * Physical devices cannot use localhost for the API — use this host for the backend.
 */
function inferLanHost() {
  const raw =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    (typeof Constants.manifest === "object" && Constants.manifest?.debuggerHost);
  if (!raw) return null;
  const host = String(raw).split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function isLoopbackHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

function replaceLoopbackWithLan(base) {
  const lan = inferLanHost();
  if (!lan) return base;
  try {
    const withProtocol = base.includes("://") ? base : `http://${base}`;
    const u = new URL(withProtocol);
    if (!isLoopbackHostname(u.hostname)) return base;
    const port = u.port || String(DEFAULT_PORT);
    return `${u.protocol}//${lan}:${port}`;
  } catch {
    return base;
  }
}

function isPrivateIpv4(hostname) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(String(hostname || ""));
}

function replacePrivateIpWithLan(base) {
  const lan = inferLanHost();
  if (!lan) return base;
  try {
    const withProtocol = base.includes("://") ? base : `http://${base}`;
    const u = new URL(withProtocol);
    if (!isPrivateIpv4(u.hostname) || u.hostname === lan) return base;
    const port = u.port || String(DEFAULT_PORT);
    return `${u.protocol}//${lan}:${port}`;
  } catch {
    return base;
  }
}

// Set in .env — do NOT include "/api"; clients use `${API_BASE_URL}/api/...`
const explicitRaw = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (() => {
  const isWeb = Platform.OS === "web";

  if (!explicitRaw) {
    if (isWeb) return `http://localhost:${DEFAULT_PORT}`;
    const lan = inferLanHost();
    if (lan) return `http://${lan}:${DEFAULT_PORT}`;
    return `http://localhost:${DEFAULT_PORT}`;
  }

  let base = normalizeBase(explicitRaw);
  // On native, localhost in .env points at the phone — swap to the PC LAN IP when Expo provides it.
  if (!isWeb) {
    try {
      const withProtocol = base.includes("://") ? base : `http://${base}`;
      const u = new URL(withProtocol);
      if (isLoopbackHostname(u.hostname)) {
        base = normalizeBase(replaceLoopbackWithLan(withProtocol));
      } else if (__DEV__ && isPrivateIpv4(u.hostname)) {
        // In dev, a stale hardcoded LAN IP in .env can break API calls after network changes.
        base = normalizeBase(replacePrivateIpWithLan(withProtocol));
      }
    } catch {
      // keep base as-is
    }
  }

  return base;
})();
