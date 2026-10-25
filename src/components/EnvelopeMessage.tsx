"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import SceneErrorBoundary from "./SceneErrorBoundary";

// three.js needs the browser, so the 3D envelope is never server-rendered.
const EnvelopeStage = dynamic(() => import("./EnvelopeStage"), { ssr: false });

const RECIPIENT = "Aunty";
const PARAGRAPHS = [
  "Happy birthday! Thank you for the laughter, the love, and every moment you make brighter just by being in it.",
  "You have a way of making everyone feel at home, and I hope this year gives back even a little of the warmth you give to all of us.",
  "Wishing you good health, big joy, and plenty of cake.",
];
const SIGN_OFF = "With all my love";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const card: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  shown: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_OUT, delayChildren: 0.25, staggerChildren: 0.13 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.35 } },
};

const line: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

const closeButton: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 1.4 } },
};

export default function EnvelopeMessage({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(Boolean(reduceMotion));
  const reveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`A birthday message for ${RECIPIENT}`}
      className="fixed inset-0 z-50 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(74,29,94,0.94)_0%,rgba(13,6,24,0.98)_75%)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5 } }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
    >
      <AnimatePresence>
        {!revealed && (
          <motion.div
            key="stage"
            className="absolute inset-0"
            exit={{ opacity: 0, transition: { duration: 0.7, ease: "easeInOut" } }}
          >
            <SceneErrorBoundary onError={reveal}>
              <EnvelopeStage recipient={RECIPIENT} onReveal={reveal} />
            </SceneErrorBoundary>
            <button
              type="button"
              onClick={reveal}
              className="absolute right-4 top-4 rounded-full border border-white/20 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealed && (
          <motion.div
            key="letter"
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4"
            initial="hidden"
            animate="shown"
            exit="exit"
          >
            <motion.article
              variants={card}
              className="max-h-[78dvh] w-[min(92vw,520px)] overflow-y-auto rounded-2xl border border-[#ead8c8] bg-[#fffaf2] px-6 py-8 text-[#4a2a3a] shadow-2xl shadow-black/50 sm:px-10 sm:py-10"
            >
              <motion.p
                variants={line}
                className="text-[0.65rem] uppercase tracking-[0.3em] text-[#b0708a] sm:text-xs"
              >
                A letter for you
              </motion.p>
              <motion.h2
                variants={line}
                className="mt-3 font-display text-3xl italic text-[#7a3550] sm:text-4xl"
              >
                Dear {RECIPIENT},
              </motion.h2>
              <motion.div
                variants={line}
                className="mt-4 h-px w-16 bg-gradient-to-r from-[#e79ab2] to-transparent"
              />
              {PARAGRAPHS.map((paragraph) => (
                <motion.p
                  key={paragraph}
                  variants={line}
                  className="mt-4 text-[0.95rem] leading-relaxed sm:text-base"
                >
                  {paragraph}
                </motion.p>
              ))}
              <motion.p variants={line} className="mt-8 font-display text-lg italic text-[#7a3550]">
                {SIGN_OFF} ♥
              </motion.p>
            </motion.article>

            <motion.button
              type="button"
              variants={closeButton}
              onClick={onClose}
              className="rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Close letter
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
