const DEFAULT_PORT = 5000;

function resolveApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) {
    return String(explicit).replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return "";
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const FIRST_SELECTABLE_YEAR = Number(
  import.meta.env.VITE_FIRST_SELECTABLE_YEAR || 2025
);

export const RESTORE_CONFIRM_PHRASE =
  import.meta.env.VITE_RESTORE_CONFIRM_PHRASE || "RESTORE_NOW";

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log("[config] API_BASE_URL =", API_BASE_URL || "(proxy → backend)");
}
