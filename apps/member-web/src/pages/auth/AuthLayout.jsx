import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children, headline }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-orange-300 via-accent to-orange-800">
      <div
        className="relative mx-auto min-h-[210px] max-w-lg bg-cover bg-center"
        style={{ backgroundImage: "url(/img4.jpg)" }}
      >
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Back Button */}
        <Link
          to="/welcome"
          className="absolute left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30 active:scale-95 shadow-md"
          aria-label="Back to welcome page"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="relative z-10 px-5 pb-6">

        </div>
      </div>
      <div className="relative z-20 -mt-10 min-h-[75.6vh] rounded-t-3xl bg-white px-6 pb-8 pt-8 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
