import { useEffect, useState } from "react";

export default function AppSecurityWrapper({ children }) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    const onVisibility = () => setBlurred(document.hidden);
    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="relative min-h-dvh">
      {children}
      {blurred ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[300] backdrop-blur-md bg-white/30"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
