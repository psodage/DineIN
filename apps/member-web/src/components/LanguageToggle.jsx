import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle({ className = "" }) {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`rounded-full bg-ink px-3 py-1.5 text-xs font-bold tracking-wide text-white shadow-lg ${className}`}
    >
      {language === "en" ? "मराठी" : "ENGLISH"}
    </button>
  );
}
