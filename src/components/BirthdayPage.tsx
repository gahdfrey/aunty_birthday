"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import EnvelopeMessage from "./EnvelopeMessage";
import SceneErrorBoundary from "./SceneErrorBoundary";

// three.js needs the browser, so the scene is never server-rendered.
const BirthdayScene = dynamic(() => import("./BirthdayScene"), { ssr: false });

const NAME = "Aunty";

function AnimatedWords({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <span key={i} aria-hidden className="animate-rise-in" style={{ animationDelay: `${delay + i * 0.045}s` }}>
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}

export default function BirthdayPage() {
  const [blown, setBlown] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const closeLetter = useCallback(() => setLetterOpen(false), []);
  // Fetch the envelope's 3D code in the background once the cake is showing, so "Read message" opens instantly.
  const preloadEnvelope = useCallback(() => {
    import("./EnvelopeStage");
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,#4a1d5e_0%,#1d0b2e_55%,#0d0618_100%)] text-white">
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <BirthdayScene blown={blown} paused={letterOpen} onReady={preloadEnvelope} />
        </SceneErrorBoundary>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-4 pt-10 text-center sm:pt-14">
        <p className="animate-fade-down text-xs uppercase tracking-[0.35em] text-pink-200/80 sm:text-sm">
          A little celebration for you
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight drop-shadow-[0_4px_24px_rgba(255,107,157,0.45)] sm:text-6xl md:text-7xl">
          <AnimatedWords text="Happy Birthday," delay={0.2} />
          <br />
          {/* Animated as one word: gradient text can't show through letters that animate separately. */}
          <span className="animate-rise-in bg-gradient-to-r from-pink-300 via-amber-200 to-pink-300 bg-clip-text italic text-transparent [animation-delay:0.9s]">
            {NAME}
          </span>
        </h1>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:gap-4 sm:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          {blown ? (
            <motion.p
              key="wish"
              className="rounded-full border border-white/15 bg-[#2a1240]/70 px-4 py-1.5 font-display text-base text-amber-100 sm:text-lg"
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              Your wish is on its way ✨
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              className="animate-fade-up text-xs text-white/60 [animation-delay:1.8s] sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Drag to look around the cake
            </motion.p>
          )}
        </AnimatePresence>

        {/* Plain CSS entrance: it plays on first paint, before React has even loaded. */}
        <div className="animate-fade-up flex w-full max-w-xs flex-col gap-3 [animation-delay:1.6s] sm:w-auto sm:max-w-none sm:flex-row">
          <motion.button
            type="button"
            onClick={() => setBlown((b) => !b)}
            className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {blown ? "Light the candles again" : "Make a wish & blow the candles"}
          </motion.button>
          {/* Solid tint instead of backdrop blur: blurring over a live 3D canvas is very costly on phones. */}
          <motion.button
            type="button"
            onClick={() => setLetterOpen(true)}
            className="rounded-full border border-white/25 bg-[#2a1240]/70 px-7 py-3 text-sm font-semibold text-white sm:text-base"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(74,29,94,0.85)" }}
            whileTap={{ scale: 0.95 }}
          >
            ✉ Read message
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {letterOpen && <EnvelopeMessage onClose={closeLetter} />}
      </AnimatePresence>
    </main>
  );
}
