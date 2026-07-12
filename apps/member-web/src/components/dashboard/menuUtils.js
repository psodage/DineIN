import { toLocalYMD, toUTCYMD } from "../../lib/dateUtils";

export const MEAL_FALLBACK_TEXT = "Chapati, Bhaji, Amti, Bhat";

export function resolveMenuFromAtMenu(menuList, dateLike) {
  const localKey = toLocalYMD(dateLike);
  const utcKey = toUTCYMD(dateLike);
  if ((!localKey && !utcKey) || !Array.isArray(menuList) || menuList.length === 0) return null;

  const found = menuList.find((m) => {
    const menuLocalKey = toLocalYMD(m?.date);
    const menuUtcKey = toUTCYMD(m?.date);
    return (
      (localKey && menuLocalKey === localKey) ||
      (utcKey && menuUtcKey === utcKey) ||
      (localKey && menuUtcKey === localKey) ||
      (utcKey && menuLocalKey === utcKey)
    );
  });
  if (!found) return null;
  return {
    lunch: String(found?.lunch ?? "").trim(),
    dinner: String(found?.dinner ?? "").trim(),
  };
}

export function resolveMealText(mealText) {
  const v = String(mealText ?? "").trim();
  if (!v) return MEAL_FALLBACK_TEXT;
  const lowered = v.toLowerCase();
  if (lowered === "undefined" || lowered === "null" || lowered === "nan") {
    return MEAL_FALLBACK_TEXT;
  }
  return v;
}

export function formatDurationLabel(diffMs) {
  if (diffMs <= 0) return "In progress";
  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `Starts in ${minutes} mins`;
  if (minutes === 0) return `Starts in ${hours} hr${hours > 1 ? "s" : ""}`;
  return `Starts in ${hours} hr ${minutes} mins`;
}
