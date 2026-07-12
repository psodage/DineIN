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
