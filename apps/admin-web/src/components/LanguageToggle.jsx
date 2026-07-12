import { useLanguage } from "@/context/LanguageContext";

export default function LanguageToggle({ className = "" }) {
  const { language, toggleLanguage } = useLanguage();
  const isEn = language === "en";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`relative flex h-8 w-[3.25rem] items-center rounded-full bg-slate-800 p-0.5 transition ${className}`}
      aria-label="Toggle language"
    >
      <span
        className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform duration-200 ${
          isEn ? "left-0.5 translate-x-0" : "left-0.5 translate-x-[1.35rem]"
        }`}
      />
      <span
        className={`relative z-10 flex-1 text-center text-[10px] font-bold ${
          isEn ? "text-slate-900" : "text-white/70"
        }`}
      >
        EN
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-[10px] font-bold ${
          !isEn ? "text-slate-900" : "text-white/70"
        }`}
      >
        MR
      </span>
    </button>
  );
}
