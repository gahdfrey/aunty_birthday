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
        <motion.span
          key={i}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: 40, rotate: -8 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: delay + i * 0.045, type: "spring", stiffness: 260, damping: 18 }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}

export default function BirthdayPage() {
  const [blown, setBlown] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const closeLetter = useCallback(() => setLetterOpen(false), []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,#4a1d5e_0%,#1d0b2e_55%,#0d0618_100%)] text-white">
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <BirthdayScene blown={blown} paused={letterOpen} />
        </SceneErrorBoundary>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-4 pt-10 text-center sm:pt-14">
        <motion.p
          className="text-xs uppercase tracking-[0.35em] text-pink-200/80 sm:text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          A little celebration for you
        </motion.p>
        <h1 className="mt-3 font-display text-4xl leading-tight drop-shadow-[0_4px_24px_rgba(255,107,157,0.45)] sm:text-6xl md:text-7xl">
          <AnimatedWords text="Happy Birthday," delay={0.2} />
          <br />
          <AnimatedWords
            text={NAME}
            delay={0.9}
            className="bg-gradient-to-r from-pink-300 via-amber-200 to-pink-300 bg-clip-text italic text-transparent"
          />
        </h1>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:gap-4 sm:pb-10">
        <AnimatePresence mode="wait">
          {blown ? (
            <motion.p
              key="wish"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-display text-base text-amber-100 backdrop-blur-md sm:text-lg"
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
              className="text-xs text-white/60 sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 1.8 } }}
              exit={{ opacity: 0 }}
            >
              Drag to look around the cake
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
        >
          <motion.button
            type="button"
            onClick={() => setBlown((b) => !b)}
            className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {blown ? "Light the candles again" : "Make a wish & blow the candles"}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setLetterOpen(true)}
            className="rounded-full border border-white/25 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-md sm:text-base"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            ✉ Read message
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {letterOpen && <EnvelopeMessage onClose={closeLetter} />}
      </AnimatePresence>
    </main>
  );
}
