import { useEffect, useState } from "react";

/** Blur content when tab is hidden (web equivalent of AppState privacy overlay). */
export default function AppSecurityWrapper({ children }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="relative min-h-full">
      {children}
      {hidden ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[9999] backdrop-blur-xl bg-white/40"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
