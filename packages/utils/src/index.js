// @dinein/utils — Shared utility functions
// This package will contain extracted utilities from both frontends.

/**
 * Format a Date to YYYY-MM-DD string in local timezone.
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function toLocalYMD(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Format a Date to YYYY-MM-DD string in UTC timezone.
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function toUTCYMD(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Get YYYY-MM month key in local timezone.
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function monthKeyLocal(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Format a number as Indian Rupee currency string.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrencyINR(amount) {
  const n = Number(amount || 0);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const STATUS_MR = {
  Active: "सक्रिय",
  Inactive: "निष्क्रिय",
};

const MEAL_PLAN_MR = {
  Lunch: "दुपारचे जेवण",
  Dinner: "रात्रीचे जेवण",
  Both: "दोन्ही",
};

export function statusMrFor(statusEn) {
  const k = String(statusEn || "").trim();
  return STATUS_MR[k] || "";
}

export function mealPlanMrFor(mealPlanEn) {
  const k = String(mealPlanEn || "").trim();
  return MEAL_PLAN_MR[k] || "";
}

export function displayStatusMr(language, statusEn, storedMr) {
  if (language !== "mr") return String(statusEn || "").trim() || "—";
  const s = String(statusEn || "").trim();
  return String(storedMr || "").trim() || statusMrFor(s) || s || "—";
}

export function displayMealPlanMr(language, mealPlanEn, storedMr) {
  if (language !== "mr") return String(mealPlanEn || "").trim() || "—";
  const m = String(mealPlanEn || "").trim();
  return String(storedMr || "").trim() || mealPlanMrFor(m) || m || "—";
}
