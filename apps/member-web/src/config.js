const DEFAULT_PORT = 5000;

function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

export const API_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) return normalizeBase(explicit);
  return `http://localhost:${DEFAULT_PORT}`;
})();
