/**
 * Marathi labels for member `status` / `mealPlan` (EN enums in API).
 * Keep in sync with backend/utils/memberLabelsMr.js
 */

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

/** Prefer stored DB Marathi; fall back to map from English. */
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

/** Poll question for admin/member UI (API: `question` / `questionMr`). */
export function formatPollQuestion(poll, language) {
  if (!poll) return "";
  return language === "mr"
    ? String(poll.questionMr || poll.question || "").trim()
    : String(poll.question || poll.questionMr || "").trim();
}

/** Same as {@link formatPollQuestion} — legacy name used by some screens/bundles. */
export const pollQuestionLine = formatPollQuestion;

/** Poll option label for admin/member UI (API: `label` / `labelMr` / `key`). */
export function formatPollOptionLabel(opt, language) {
  const key = String(opt?.key || "").trim().toLowerCase();
  const en = String(opt?.label || "").trim();
  const mr = String(opt?.labelMr || "").trim();

  if (language === "mr") {
    return mr || en || legacyPollOptionLabelForKey(key) || String(opt?.key || "").trim();
  }
  if (en) return en;
  if (mr) return mr;
  return legacyPollOptionLabelForKey(key) || String(opt?.key || "").trim();
}

/** Old polls / keys with no stored labels — avoid overriding dynamic DB text. */
function legacyPollOptionLabelForKey(key) {
  if (key === "veg") return "Veg";
  if (key === "nonveg") return "Non Veg";
  return "";
}

/** Same as {@link formatPollOptionLabel} — legacy name. */
export const pollOptionLabel = formatPollOptionLabel;
