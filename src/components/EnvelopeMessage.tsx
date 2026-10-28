"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import SceneErrorBoundary from "./SceneErrorBoundary";

// three.js needs the browser, so the 3D envelope is never server-rendered.
const EnvelopeStage = dynamic(() => import("./EnvelopeStage"), { ssr: false });

const RECIPIENT = "Aunty";
const PARAGRAPHS = [
  "They say there are four kinds of luck, and I want to talk about the one called dumb luck: the kind no one can earn, plan for, or influence. It simply happens by chance. That’s exactly the kind of luck that gave me you as my aunt, and I’ll never stop being grateful for it. Today, I want the whole world to know how thankful I am to have you in my life.",
  "I thought long and hard about how to make your birthday extra special this year, and I decided to use my skills to create something lasting: a celebration of you that lives online. As long as the internet exists (and by my estimate, that’ll be a very long time), anyone who visits this page will feel just how much you’re appreciated and loved.",
  "Happy birthday, Aunty! Wishing you a wonderful day and many more beautiful years ahead.",
];
const SIGN_OFF = "Your nephew T";

// The letter is written in line by line while she reads: each line is uncovered left to right,
// a moment after the one above it. Lines are measured from the real layout, so this follows the
// text however it wraps, and only one small cover per line animates.
const LINES_START = 1.6;
const LINE_STAGGER = 0.17;
const PARAGRAPH_PAUSE = 0.35;

type Line = { top: number; left: number; width: number; height: number; delay: number };
type LineLayout = { paragraphs: Line[][]; signOffDelay: number };

// Groups each paragraph's words into the lines they wrapped onto. Uses layout offsets, which
// ignore the card's 3D transforms, so it measures correctly even mid-animation.
function measureLines(paragraphs: HTMLElement[]): LineLayout {
  let delay = LINES_START;
  const measured = paragraphs.map((paragraph) => {
    const lines: Line[] = [];
    for (const word of Array.from(paragraph.querySelectorAll<HTMLElement>("[data-word]"))) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - word.offsetTop) < 2) {
        last.width = word.offsetLeft + word.offsetWidth - last.left;
      } else {
        lines.push({ top: word.offsetTop, left: word.offsetLeft, width: word.offsetWidth, height: word.offsetHeight, delay });
        delay += LINE_STAGGER;
      }
    }
    delay += PARAGRAPH_PAUSE;
    return lines;
  });
  return { paragraphs: measured, signOffDelay: delay };
}

// Hearts and sparkles that drift up through the room behind the letter. Spread out by index
// rather than at random so every visit looks the same and nothing shifts between renders.
const FLOATERS = Array.from({ length: 16 }, (_, i) => ({
  symbol: i % 3 === 0 ? "✦" : "♥",
  left: `${(i * 37 + 7) % 100}%`,
  size: `${0.8 + ((i * 7) % 5) * 0.3}rem`,
  duration: `${9 + ((i * 5) % 7)}s`,
  delay: `${-((i * 1.7) % 10)}s`,
  drift: `${((i * 13) % 9) - 4}vw`,
  color: ["#f9a8c4", "#fcd6a4", "#e79ab2", "#fff1d6"][i % 4],
}));

// Stays mounted (invisible and paused) once the page has settled, so opening the letter
// reuses an already-prepared 3D scene instead of building one in the middle of the animation.
export default function EnvelopeMessage({
  open,
  runId,
  onClose,
}: {
  open: boolean;
  // Goes up each time the letter is opened, which restarts the envelope sequence.
  runId: number;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [revealedRun, setRevealedRun] = useState(-1);
  const revealed = Boolean(reduceMotion) || revealedRun === runId;
  const reveal = useCallback(() => setRevealedRun(runId), [runId]);
  const playing = open && !revealed;
  // Tapping the letter finishes the writing straight away, for anyone who would rather just read.
  const [writtenRun, setWrittenRun] = useState(-1);
  const written = writtenRun === runId;
  const letterBody = useRef<HTMLElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [lineLayout, setLineLayout] = useState<LineLayout | null>(null);

  // Measured while the letter is still hidden, and again if the text rewraps (a phone rotating,
  // the font finishing loading), so revealing it never has to measure anything.
  useEffect(() => {
    const paragraphs = paragraphRefs.current.filter((paragraph) => paragraph !== null);
    const measure = () => {
      const next = measureLines(paragraphs);
      setLineLayout((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    const observer = new ResizeObserver(measure);
    paragraphs.forEach((paragraph) => observer.observe(paragraph));
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  // Each opening starts reading from the top again.
  useEffect(() => {
    letterBody.current?.scrollTo(0, 0);
  }, [runId]);

  // The letter tilts gently toward the mouse, so it feels like paper held up in the light.
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(tiltY, { stiffness: 120, damping: 18 });
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    tiltX.set((0.5 - event.clientY / window.innerHeight) * 10);
    tiltY.set((event.clientX / window.innerWidth - 0.5) * 12);
  };
  const untilt = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={`A birthday message for ${RECIPIENT}`}
      className="fixed inset-0 z-50 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(74,29,94,0.94)_0%,rgba(13,6,24,0.98)_75%)]"
      // While closed, this full-screen layer must not catch any taps or drags meant for the page.
      // `inert` disables everything inside it, including the 3D canvas, which turns pointer
      // events back on for itself and would otherwise ignore a parent's pointer-events: none.
      inert={!open}
      initial={{ opacity: 0, visibility: "hidden" }}
      animate={
        open ? { opacity: 1, visibility: "visible" } : { opacity: 0, transitionEnd: { visibility: "hidden" } }
      }
      transition={{ duration: open ? 0.5 : 0.45, ease: "easeOut" }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={{ opacity: playing ? 1 : 0 }}
      >
        <SceneErrorBoundary onError={reveal}>
          <EnvelopeStage recipient={RECIPIENT} playing={playing} idle={!open} runId={runId} onReveal={reveal} />
        </SceneErrorBoundary>
        {playing && (
          <button
            type="button"
            onClick={reveal}
            className="absolute right-4 top-4 rounded-full border border-white/20 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            Skip
          </button>
        )}
      </div>

      {/* The readable letter is always mounted and simply hidden until the 3D letter has opened,
          so the hand-off only switches a class instead of building the page at that very moment.
          Its animations all run in CSS on the compositor (see globals.css), so they stay smooth
          even if the phone's main thread is briefly busy. */}
      <div
        className={`letter-stage absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 [perspective:1400px] ${revealed ? "is-shown" : ""} ${open ? "" : "is-leaving"}`}
        onPointerMove={tilt}
        onPointerLeave={untilt}
      >
        {!reduceMotion && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {FLOATERS.map((floater, i) => (
              <span
                key={i}
                className="letter-floater absolute bottom-0"
                style={
                  {
                    left: floater.left,
                    fontSize: floater.size,
                    color: floater.color,
                    animationDuration: floater.duration,
                    animationDelay: floater.delay,
                    "--drift": floater.drift,
                  } as CSSProperties
                }
              >
                {floater.symbol}
              </span>
            ))}
          </div>
        )}

        {/* A burst of warm light covers the moment the 3D letter becomes the readable one. */}
        <div
          aria-hidden
          className="letter-flash pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,240,214,0.95)_0%,rgba(255,190,170,0.5)_30%,rgba(255,150,190,0)_70%)]"
        />

        <motion.div className="relative" style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
          <div
            onClick={() => setWrittenRun(runId)}
            className={`letter-card relative overflow-hidden rounded-2xl border border-[#ead8c8] bg-[#fffaf2] text-[#4a2a3a] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_60px_-10px_rgba(255,190,150,0.45)] ${written ? "letter-written" : ""}`}
          >
            {/* A band of light sweeps across the paper as it settles. */}
            <div aria-hidden className="letter-sheen pointer-events-none absolute inset-0 z-10" />

            <article
              ref={letterBody}
              className="max-h-[76dvh] w-[min(92vw,520px)] overflow-y-auto px-6 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12"
            >
              <p className="letter-kicker text-[0.65rem] uppercase tracking-[0.3em] text-[#b0708a] sm:text-xs">
                A letter for you
              </p>
              {/* The greeting is uncovered left to right, like a pen writing it. */}
              <h2 className="letter-greeting relative mt-3 overflow-hidden pb-1 font-display text-3xl italic text-[#7a3550] sm:text-4xl">
                Dear {RECIPIENT},
              </h2>
              <div className="letter-divider mt-4 h-px w-16 origin-left bg-gradient-to-r from-[#e79ab2] to-transparent" />
              {PARAGRAPHS.map((paragraph, i) => (
                <p
                  key={i}
                  ref={(element) => {
                    paragraphRefs.current[i] = element;
                  }}
                  className="relative mt-4 text-[0.95rem] leading-relaxed sm:text-base"
                >
                  {paragraph.split(" ").map((word, j) => (
                    <Fragment key={j}>
                      <span data-word>{word}</span>{" "}
                    </Fragment>
                  ))}
                  <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    {lineLayout?.paragraphs[i]?.map((line, j) => (
                      <span
                        key={j}
                        className="letter-line-cover"
                        style={{
                          top: line.top - 1,
                          left: line.left - 32,
                          width: line.width + 40,
                          height: line.height + 2,
                          animationDelay: `${line.delay}s`,
                        }}
                      />
                    ))}
                  </span>
                </p>
              ))}
              <p
                className="letter-sign-off mt-8 font-display text-lg italic text-[#7a3550]"
                style={{ animationDelay: `${lineLayout?.signOffDelay ?? LINES_START}s` }}
              >
                {SIGN_OFF}
              </p>
            </article>
          </div>

          {/* A wax seal stamps down onto the top of the letter. */}
          <div
            aria-hidden
            className="letter-seal absolute -top-6 left-1/2 -ml-6 flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d23a62,#a3153b_60%,#7d0f2d)] text-lg text-[#f5c86a] shadow-[0_6px_16px_rgba(0,0,0,0.45),inset_0_-3px_6px_rgba(0,0,0,0.3)]"
          >
            ♥
          </div>
        </motion.div>

        <button
          type="button"
          onClick={onClose}
          className="letter-close relative rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Close letter
        </button>
      </div>
    </motion.div>
  );
}
