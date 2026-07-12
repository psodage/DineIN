import { useEffect, useState } from "react";
import { HelpCircle, RefreshCw, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import { MOBILE_MAX_WIDTH } from "../hooks/useMobileCheck";

/**
 * Full-screen gate shown when the app is accessed from a non-mobile context.
 * Implements a modern, responsive design with interactive desktop phone mockup,
 * dark mode support, and development debug details.
 */
export default function MobileOnly({
  width,
  osName,
  browserName,
  deviceType,
  blockReason,
  isMobileWidth,
  isMobilePhone,
  refresh,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const isDev = import.meta.env.DEV;

  const qrUrl =
    import.meta.env.VITE_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://dinein.app");

  // Prevent scrolling on the desktop page when mounted
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.height = "100vh";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] min-h-dvh w-full overflow-hidden flex flex-col justify-between p-6 md:p-12 bg-gradient-to-br from-slate-50 via-teal-50/10 to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100 transition-colors duration-300">
      
      {/* Ambient glowing blobs in the background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand/10 dark:bg-brand/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 dark:bg-accent/5 blur-[120px] pointer-events-none" />

      {/* Header with App Branding */}
      <header className="relative z-10 flex items-center gap-3 select-none animate-fade-in">
        <img src="/logo2.png" alt="DineIN" className="h-10 w-auto drop-shadow-md" />
        <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
        <div>
          <p className="text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">DineIN</p>
          <p className="text-[10px] text-brand dark:text-orange-400 font-medium">Eat Smart. Live Easy.</p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-grow flex flex-col md:flex-row items-center justify-center gap-12 lg:gap-20 max-w-5xl mx-auto w-full py-8">
        
        {/* Left Side: Sleek Mobile Phone Mockup (Visible on md and larger) */}
        <div className="relative w-[280px] h-[520px] rounded-[48px] bg-slate-900 dark:bg-slate-950 p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border-4 border-slate-800/80 dark:border-slate-800 ring-1 ring-slate-950/10 dark:ring-white/10 hidden md:flex flex-col overflow-hidden animate-slide-up select-none">
          
          {/* Notch / Speaker + Camera */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 dark:bg-slate-950 rounded-full z-20 flex items-center justify-center gap-1.5 px-3">
            <div className="w-8 h-1 bg-slate-800 dark:bg-slate-800/60 rounded-full" />
            <div className="w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-800/50" />
          </div>

          {/* Inner Simulated Screen */}
          <div className="relative w-full h-full bg-slate-950 rounded-[38px] overflow-hidden flex flex-col border border-slate-800/40">
            {/* Screen Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-dark/20 via-slate-900 to-orange-950/20 opacity-90" />
            
            {/* Simulated Status Bar */}
            <div className="relative z-10 flex justify-between items-center px-6 pt-3.5 pb-1 text-[10px] font-semibold text-white/50">
              <span>12:30</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.79-1.79C9.09 19.64 10.5 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                </svg>
                <div className="w-4 h-2.5 border border-white/40 rounded-sm p-0.5 flex items-center">
                  <div className="h-full w-full bg-white/70 rounded-2xs" />
                </div>
              </div>
            </div>

            {/* Screen App Mockup Content */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 text-center">
              
              {/* Logo in Mockup */}
              <div className="flex items-center gap-1.5 mb-6">
                <img src="/logo2.png" alt="DineIN" className="h-6 w-auto drop-shadow-md" />
                <span className="text-[10px] font-extrabold tracking-wide text-white">DineIN</span>
              </div>

              {/* QR Code Card inside Screen */}
              <div className="w-full max-w-[190px] bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md flex flex-col items-center">
                <span className="text-[9px] font-bold tracking-wider text-orange-400 uppercase mb-2">Scan on Phone</span>
                <div className="bg-white p-2.5 rounded-xl shadow-inner">
                  <QRCodeSVG value={qrUrl} size={110} level="M" includeMargin={false} />
                </div>
                <span className="text-[8px] text-white/50 truncate w-full mt-2.5 text-center">
                  {qrUrl}
                </span>
              </div>

              {/* Quick instructions inside screen */}
              <p className="text-[9px] text-white/60 max-w-[150px] mt-4 leading-normal">
                Point your phone's camera at the screen to start dining.
              </p>
            </div>

            {/* Home Indicator */}
            <div className="relative z-10 w-full flex justify-center pb-2">
              <div className="w-20 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Side: Message & Interactive Controls */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-md w-full animate-slide-up">
          
          {/* Fallback Icon for smaller sizes where phone mockup is hidden */}
          <div className="md:hidden flex items-center justify-center mb-6 w-16 h-16 rounded-3xl bg-brand/10 text-brand dark:bg-brand/20 dark:text-orange-400 animate-bounce">
            <Smartphone className="w-8 h-8" />
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            Mobile Experience Only
          </h1>

          {/* Description */}
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            This application is designed and optimized exclusively for smartphones. Please open this website on your mobile device to continue.
          </p>

          {/* QR Code for small screens (inline when phone mockup isn't visible side-by-side) */}
          <div className="md:hidden mt-6 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG value={qrUrl} size={80} level="M" includeMargin={false} />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800 dark:text-orange-400 uppercase tracking-wider">Scan to continue</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[160px] leading-snug">
                Scan this QR code to load the app instantly on your phone.
              </p>
            </div>
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full">
            <Button
              variant="primary"
              className="w-full sm:w-auto px-8 py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              onClick={refresh}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-slate-700 dark:text-slate-300"
              onClick={() => setWhyOpen(true)}
            >
              <HelpCircle className="w-4 h-4" />
              Why?
            </Button>
          </div>

          {/* Developer Debug Panel (only displayed in development mode) */}
          {isDev && (
            <div className="mt-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-400 font-mono space-y-1 w-full text-left">
              <div className="font-bold uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Developer Debug Info
              </div>
              <div className="flex justify-between border-b border-amber-500/5 pb-1">
                <span>Screen Width:</span>
                <span className="font-bold">{width}px (Max: {MOBILE_MAX_WIDTH}px)</span>
              </div>
              <div className="flex justify-between border-b border-amber-500/5 pb-1">
                <span>Device Type:</span>
                <span className="font-bold capitalize">{deviceType}</span>
              </div>
              <div className="flex justify-between border-b border-amber-500/5 pb-1">
                <span>OS / Browser:</span>
                <span className="font-bold">{osName} / {browserName}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span>Block Reason:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{blockReason || "None"}</span>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer Footer Info */}
      <footer className="relative z-10 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 dark:text-slate-500 gap-2 select-none animate-fade-in mt-4">
        <p>© {new Date().getFullYear()} DineIN Systems. All rights reserved.</p>
        <p className="flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" />
          Optimized for Android & iOS smartphones
        </p>
      </footer>

      {/* Explain Why Modal */}
      <Modal open={whyOpen} title="Why mobile only?" onClose={() => setWhyOpen(false)}>
        <div className="space-y-3 text-left leading-relaxed text-slate-600 dark:text-slate-400">
          <p>
            <strong className="text-slate-800 dark:text-white">DineIN Member</strong> is engineered as a Progressive Web App (PWA) specifically tailored for smartphones.
          </p>
          <p>
            To deliver key mobile functionalities such as instant meal notifications, camera-based QR code check-ins, touch-optimized food ordering, and native-feeling offline capabilities, the app requires a mobile environment.
          </p>
          <p className="text-xs border-t border-slate-100 dark:border-slate-800 pt-3 text-slate-500 dark:text-slate-500 italic">
            Tip for developers: Resize your desktop browser window to less than {MOBILE_MAX_WIDTH}px width to simulate a smartphone view and bypass this gate.
          </p>
        </div>
      </Modal>
    </div>
  );
}
