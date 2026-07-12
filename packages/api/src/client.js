import axios from "axios";

/**
 * Create a preconfigured axios instance for DineIN API.
 * @param {object} options
 * @param {string} options.baseURL - API base URL
 * @param {() => string|null} options.getToken - Function to retrieve current auth token
 * @param {(token: string) => void} [options.onTokenRefreshed] - Callback when token is refreshed
 * @returns {import("axios").AxiosInstance}
 */
export default function createApiClient({ baseURL, getToken, onTokenRefreshed }) {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
  });

  // Attach auth token to every request
  instance.interceptors.request.use((config) => {
    const token = getToken?.();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return instance;
}
