"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";

const RECIPIENT = "Aunty";
const PARAGRAPHS = [
  "Happy birthday! Thank you for the laughter, the love, and every moment you make brighter just by being in it.",
  "You have a way of making everyone feel at home, and I hope this year gives back even a little of the warmth you give to all of us.",
  "Wishing you good health, big joy, and plenty of cake.",
];
const SIGN_OFF = "With all my love";

// Gentle ease-out used for the big movements so they land softly.
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export default function EnvelopeMessage({ onClose }: { onClose: () => void }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;

    async function play() {
      await animate([
        // Fly in from far away and zoom right up to the viewer.
        [
          ".envelope",
          {
            opacity: [0, 1],
            scale: [0.08, 1.4],
            rotateZ: [-28, 3],
            rotateY: [-65, 0],
            y: [260, 0],
            filter: ["blur(14px)", "blur(0px)"],
          },
          { duration: 1.2, ease: EASE_OUT },
        ],
        // Back off to a comfortable size with a small tilt.
        [".envelope", { scale: 0.9, rotateZ: 0, rotateX: [0, 14, 0] }, { duration: 0.9, ease: EASE_IN_OUT }],
        [".seal", { scale: [1, 1.3, 0], opacity: [1, 1, 0] }, { duration: 0.5 }],
        [".flap", { rotateX: [0, 180] }, { duration: 0.8, ease: EASE_IN_OUT }],
      ]);
      if (cancelled) return;

      // Once open, the flap tucks behind the letter so the letter can slide out over it.
      // Set directly: motion applies a sequenced zIndex from the very first frame.
      const flap = scope.current.querySelector<HTMLElement>(".flap");
      if (flap) flap.style.zIndex = "0";

      await animate([
        [".letter", { y: ["0%", "-62%"] }, { duration: 0.9, ease: EASE_OUT }],
        [".envelope", { y: 360, opacity: 0, scale: 0.7 }, { duration: 0.7, ease: "easeIn", at: "+0.15" }],
        [
          ".letter-full",
          { opacity: [0, 1], scale: [0.55, 1], y: [-80, 0], rotateX: [25, 0] },
          { duration: 0.9, ease: EASE_OUT, at: "-0.45" },
        ],
        [".line", { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, delay: stagger(0.15), at: "-0.3" }],
        [".close-btn", { opacity: [0, 1], y: [10, 0] }, { duration: 0.4 }],
      ]);
    }

    play();
    return () => {
      cancelled = true;
    };
  }, [animate, scope]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <motion.div
      ref={scope}
      role="dialog"
      aria-modal="true"
      aria-label={`A birthday message for ${RECIPIENT}`}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0d0618]/75 px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      style={{ perspective: 1400 }}
    >
      <div
        className="envelope relative aspect-[3/2] w-[min(84vw,420px)] opacity-0"
        // Its own perspective (instead of preserve-3d) keeps the flap flip 3D while z-index still controls layering.
        style={{ perspective: 900 }}
      >
        <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-[#d98aa2] to-[#c46f8a] shadow-2xl shadow-black/50" />

        <div
          className="flap absolute inset-x-0 top-0 z-[3] h-[56%] bg-gradient-to-b from-[#f4b6c7] to-[#e293ab]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            transformOrigin: "top",
          }}
        />

        <div className="letter absolute inset-x-[6%] top-[7%] z-[1] h-[86%] rounded-md bg-[#fffaf2] p-[6%] shadow-md">
          <p className="font-display text-lg italic text-[#7a3550] sm:text-xl">Dear {RECIPIENT},</p>
          <div className="mt-3 space-y-2">
            <div className="h-1.5 w-full rounded bg-[#ecdcd0]" />
            <div className="h-1.5 w-5/6 rounded bg-[#ecdcd0]" />
            <div className="h-1.5 w-2/3 rounded bg-[#ecdcd0]" />
          </div>
        </div>

        <div
          className="absolute inset-0 z-[2] rounded-b-lg bg-gradient-to-t from-[#f0a5bb] to-[#f7c3d1]"
          style={{ clipPath: "polygon(0 0, 50% 54%, 100% 0, 100% 100%, 0 100%)" }}
        />

        <div className="absolute left-1/2 top-[56%] z-[4] w-[15%] -translate-x-1/2 -translate-y-1/2">
          <div className="seal flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-[#c81d4a] to-[#8e0f30] text-xl text-amber-200 shadow-lg ring-2 ring-[#a3173b]/60 sm:text-2xl">
            ♥
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 pointer-events-none">
        <article className="letter-full pointer-events-auto max-h-[78dvh] w-[min(92vw,520px)] overflow-y-auto rounded-2xl border border-[#ead8c8] bg-[#fffaf2] px-6 py-8 text-[#4a2a3a] opacity-0 shadow-2xl shadow-black/50 sm:px-10 sm:py-10">
          <p className="line text-[0.65rem] uppercase tracking-[0.3em] text-[#b0708a] sm:text-xs">
            A letter for you
          </p>
          <h2 className="line mt-3 font-display text-3xl italic text-[#7a3550] sm:text-4xl">
            Dear {RECIPIENT},
          </h2>
          <div className="line mt-4 h-px w-16 bg-gradient-to-r from-[#e79ab2] to-transparent" />
          {PARAGRAPHS.map((paragraph) => (
            <p key={paragraph} className="line mt-4 text-[0.95rem] leading-relaxed sm:text-base">
              {paragraph}
            </p>
          ))}
          <p className="line mt-8 font-display text-lg italic text-[#7a3550]">{SIGN_OFF} ♥</p>
        </article>

        <button
          type="button"
          onClick={onClose}
          className="close-btn pointer-events-auto rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-medium text-white opacity-0 backdrop-blur hover:bg-white/20"
        >
          Close letter
        </button>
      </div>
    </motion.div>
  );
}
