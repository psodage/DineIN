import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

const BG_IMAGES = ["/img1.jpg", "/img2.jpg"];

export default function WelcomePage() {
  const navigate = useNavigate();
  const [bgIndex, setBgIndex] = useState(0);
  const [guestOpen, setGuestOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setBgIndex((i) => (i + 1) % BG_IMAGES.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      {BG_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[4500ms] ${i === bgIndex ? "opacity-100" : "opacity-0"
            }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/55 via-stone-900/40 to-slate-900/75" />

      <div className="relative z-10 flex min-h-dvh flex-col px-6 pb-8 safe-top safe-bottom">
        <div className="flex items-center gap-3 pt-4">
          <img src="/logo2.png" alt="DineIN" className="h-10 w-auto drop-shadow-lg" />
          <div className="h-11 w-px bg-white/80" />
          <div>
            <p className="text-sm font-extrabold tracking-wide">DineIN</p>
            <p className="text-[10px] text-orange-100">Eat Smart. Live Easy.</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="max-w-sm text-lg font-semibold drop-shadow-md">
            Smart way to manage your daily meals
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/90 drop-shadow">
            Track meals, manage subscriptions, and simplify mess life effortlessly.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="accent"
            className="w-full rounded-none backdrop-blur-none "
            onClick={() => navigate("/login")}
          >

            Sign In
            <LogIn className="h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={() => setGuestOpen(true)}
            className="w-full py-3 text-sm font-semibold text-white/85 hover:text-white"
          >
            Continue as Guest
          </button>
          <p className="pt-2 text-center text-xs text-white/60">
            By continuing, you agree to Terms and Privacy.
          </p>
        </div>
      </div>

      <Modal open={guestOpen} title="Unavailable" onClose={() => setGuestOpen(false)}>
        Guest option is currently unavailable.
      </Modal>
    </div>
  );
}
