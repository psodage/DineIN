import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Thin orange progress bar at the top of the screen on every route change */
function TopProgressBar({ running }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (running) {
      setVisible(true);
      setWidth(0);

      // Animate to ~85% quickly, then slow down
      let w = 0;
      const tick = () => {
        w = w < 70 ? w + 4 : w < 85 ? w + 0.5 : w;
        setWidth(w);
        if (w < 85) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Complete the bar
      cancelAnimationFrame(rafRef.current);
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [running]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] h-[3px] bg-transparent">
      <div
        style={{
          width: `${width}%`,
          transition: width === 100 ? "width 0.2s ease-out" : "width 0.1s linear",
          opacity: width === 100 ? 0 : 1,
        }}
        className="h-full bg-accent shadow-[0_0_8px_2px_#f97316aa] transition-opacity duration-300"
      />
    </div>
  );
}

/** Wraps page content with a fade+slide-up animation on route change */
export function AnimatedPage({ children }) {
  const { pathname } = useLocation();
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    setAnimating(true);
  }, [pathname]);

  return (
    <div
      key={pathname}
      onAnimationEnd={() => setAnimating(false)}
      className={animating ? "animate-page-enter" : ""}
    >
      {children}
    </div>
  );
}

/** Drop this once inside AppRoutes — it listens to location changes */
export default function PageTransition() {
  const location = useLocation();
  const [running, setRunning] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setRunning(true);
      const t = setTimeout(() => setRunning(false), 350);
      return () => clearTimeout(t);
    }
  }, [location]);

  return <TopProgressBar running={running} />;
}
