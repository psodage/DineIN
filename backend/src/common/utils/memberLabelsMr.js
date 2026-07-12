// Fixed Marathi labels for member enum fields (canonical EN keys stay in DB).

const STATUS_MR = {
  Active: "सक्रिय",
  Inactive: "निष्क्रिय",
};

const MEAL_PLAN_MR = {
  Lunch: "दुपारचे जेवण",
  Dinner: "रात्रीचे जेवण",
  Both: "दोन्ही",
};

function statusMrFor(statusEn) {
  const k = String(statusEn || "").trim();
  return STATUS_MR[k] || "";
}

function mealPlanMrFor(mealPlanEn) {
  const k = String(mealPlanEn || "").trim();
  return MEAL_PLAN_MR[k] || "";
}

module.exports = {
  statusMrFor,
  mealPlanMrFor,
};
