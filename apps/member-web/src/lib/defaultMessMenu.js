export const DEFAULT_MESS_MENU = {
  lunch: "Chappati + Bhaji + Amti + Rice",
  lunchMr: "चपाती + भाजी + आमटी + भात",
  dinner: "Chappati + Bhaji + Amti + Rice",
  dinnerMr: "चपाती + भाजी + आमटी + भात",
};

const THURSDAY_DEFAULT_DINNER = {
  dinner: "Bhat + Amti",
  dinnerMr: "भात + आमटी",
};

export function getDefaultMessMenuForDate(dateLike) {
  if (dateLike == null) return { ...DEFAULT_MESS_MENU };
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return { ...DEFAULT_MESS_MENU };
  if (d.getDay() !== 4) return { ...DEFAULT_MESS_MENU };
  return { ...DEFAULT_MESS_MENU, ...THURSDAY_DEFAULT_DINNER };
}
