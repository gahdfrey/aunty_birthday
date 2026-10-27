"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { birthdayAudio } from "@/lib/birthdayAudio";
import EnvelopeMessage from "./EnvelopeMessage";
import SceneErrorBoundary from "./SceneErrorBoundary";
import SoundToggle from "./SoundToggle";

// three.js needs the browser, so the scene is never server-rendered.
const BirthdayScene = dynamic(() => import("./BirthdayScene"), { ssr: false });

const NAME = "Aunty";
// How long the "close your eyes and make a wish" moment lasts before the candles go out.
const WISH_SECONDS = 3.2;

type WishPhase = "idle" | "wishing" | "blown";

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
  const [phase, setPhase] = useState<WishPhase>("idle");
  const [celebrating, setCelebrating] = useState(false);
  const blown = phase === "blown";
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterRun, setLetterRun] = useState(0);
  const [envelopeMounted, setEnvelopeMounted] = useState(false);
  const closeLetter = useCallback(() => setLetterOpen(false), []);
  const openLetter = () => {
    setLetterRun((run) => run + 1);
    setEnvelopeMounted(true);
    setLetterOpen(true);
  };
  // Prepare the envelope's 3D scene in the background once the cake's intro has finished,
  // so "Read message" plays instantly without competing with the intro for the GPU.
  // The audio engine is prepared a little later still, so the two never land on the same frame.
  const prepareEnvelope = useCallback(() => {
    setTimeout(() => setEnvelopeMounted(true), 2500);
    setTimeout(() => birthdayAudio.prepare(), 4000);
  }, []);

  // The wish moment: music softens while the visitor wishes, then the candles go out.
  useEffect(() => {
    if (phase !== "wishing") return;
    // The blow-out sound is scheduled now, timed on the audio clock to land as the candles go out.
    birthdayAudio.duck(true);
    const cancelBlowOut = birthdayAudio.blowOut(WISH_SECONDS);
    birthdayAudio.duck(false, WISH_SECONDS);
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      setPhase("blown");
      setCelebrating(true);
    }, WISH_SECONDS * 1000);
    return () => {
      clearTimeout(timer);
      // Only an interrupted wish cancels the sound (in development, React runs effects twice).
      if (!finished) cancelBlowOut();
    };
  }, [phase]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), 2800);
    return () => clearTimeout(timer);
  }, [celebrating]);

  const toggleCandles = () => {
    if (phase === "idle") {
      setPhase("wishing");
    } else if (phase === "blown") {
      setPhase("idle");
      setCelebrating(false);
      birthdayAudio.light();
    }
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,#4a1d5e_0%,#1d0b2e_55%,#0d0618_100%)] text-white">
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <BirthdayScene blown={blown} paused={letterOpen} onReady={prepareEnvelope} />
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

      <AnimatePresence>
        {phase === "wishing" && (
          <motion.div
            key="wishing"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(13,6,24,0.1)_0%,rgba(13,6,24,0.75)_80%)] px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            transition={{ duration: 0.6 }}
          >
            <motion.p
              className="text-xs uppercase tracking-[0.35em] text-pink-200/80 sm:text-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Close your eyes
            </motion.p>
            <motion.p
              className="mt-2 font-display text-3xl italic text-amber-100 sm:text-5xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.7 }}
            >
              and make a wish…
            </motion.p>
            <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/15 sm:w-56">
              <motion.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-pink-400 to-amber-300"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: WISH_SECONDS, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrating && (
          <motion.div
            key="celebrate"
            className="pointer-events-none absolute inset-x-0 top-[36%] flex justify-center px-6 text-center"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.08, y: -16, transition: { duration: 0.5 } }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          >
            <div>
              <p className="font-display text-4xl text-amber-100 drop-shadow-[0_4px_24px_rgba(255,107,157,0.6)] sm:text-6xl">
                Wish made! 🎉
              </p>
              <p className="mt-2 text-sm text-white/85 sm:text-base">May every bit of it come true</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          ) : phase === "idle" ? (
            <motion.p
              key="hint"
              className="animate-fade-up text-xs text-white/60 [animation-delay:1.8s] sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Drag to look around the cake
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Plain CSS entrance: it plays on first paint, before React has even loaded. */}
        <div className="animate-fade-up flex w-full max-w-xs flex-col gap-3 [animation-delay:1.6s] sm:w-auto sm:max-w-none sm:flex-row">
          <motion.button
            type="button"
            onClick={toggleCandles}
            disabled={phase === "wishing"}
            className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 disabled:opacity-80 sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {phase === "wishing"
              ? "Making a wish…"
              : blown
                ? "Light the candles again"
                : "Make a wish & blow the candles"}
          </motion.button>
          {/* Solid tint instead of backdrop blur: blurring over a live 3D canvas is very costly on phones. */}
          <motion.button
            type="button"
            onClick={openLetter}
            className="rounded-full border border-white/25 bg-[#2a1240]/70 px-7 py-3 text-sm font-semibold text-white sm:text-base"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(74,29,94,0.85)" }}
            whileTap={{ scale: 0.95 }}
          >
            ✉ Read message
          </motion.button>
        </div>
      </div>

      <SoundToggle />
      {envelopeMounted && <EnvelopeMessage open={letterOpen} runId={letterRun} onClose={closeLetter} />}
    </main>
  );
}
