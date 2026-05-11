import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Penny-eTracker — Track. Deliver. Trust." },
      { name: "description", content: "Penny-eTracker splash — fast, reliable parcel tracking and delivery." },
    ],
  }),
});

function Index() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[oklch(0.98_0.01_240)] via-background to-[oklch(0.95_0.03_250)]">
      {/* animated road lines */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-40">
        <div className="h-1 w-2/3 animate-pulse rounded-full bg-gradient-to-r from-transparent via-[oklch(0.55_0.2_260)] to-transparent" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        {/* speed lines */}
        <div className="absolute -left-24 top-1/3 flex flex-col gap-2">
          <span className="block h-1 w-10 origin-right animate-[dash_1.2s_ease-out_infinite] rounded-full bg-[oklch(0.6_0.2_255)]" />
          <span className="block h-1 w-16 origin-right animate-[dash_1.2s_ease-out_infinite_0.15s] rounded-full bg-[oklch(0.55_0.2_255)]" />
          <span className="block h-1 w-8 origin-right animate-[dash_1.2s_ease-out_infinite_0.3s] rounded-full bg-[oklch(0.65_0.18_255)]" />
        </div>

        <h1 className="sr-only">Penny-eTracker</h1>

        <img
          src={logo}
          alt="Penny-eTracker logo"
          className="h-64 w-64 animate-[floatIn_900ms_cubic-bezier(0.2,0.9,0.3,1.2)_both] drop-shadow-[0_20px_40px_oklch(0.55_0.2_260/0.25)] sm:h-80 sm:w-80"
        />

        {/* loading bar */}
        <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-[oklch(0.92_0.02_250)]">
          <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[oklch(0.55_0.2_260)] to-[oklch(0.7_0.2_45)]" />
        </div>

        <p
          className={`text-sm tracking-[0.3em] text-muted-foreground transition-opacity duration-700 ${
            done ? "opacity-100" : "opacity-60"
          }`}
        >
          {done ? "READY" : "LOADING"}
        </p>
      </div>

      <style>{`
        @keyframes floatIn {
          0% { opacity: 0; transform: translateY(24px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @keyframes dash {
          0% { transform: scaleX(0); opacity: 0; }
          50% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0) translateX(40px); opacity: 0; }
        }
      `}</style>
    </main>
  );
}
