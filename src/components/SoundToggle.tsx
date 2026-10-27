"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { birthdayAudio, type AudioState } from "@/lib/birthdayAudio";

const SERVER_STATE: AudioState = { started: false, muted: false };

export function useAudioState() {
  return useSyncExternalStore(birthdayAudio.subscribe, birthdayAudio.getSnapshot, () => SERVER_STATE);
}

// Browsers only allow sound after the visitor interacts, so the music starts on their first tap anywhere.
function useStartAudioOnFirstGesture() {
  useEffect(() => {
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    const start = (event: Event) => {
      // The sound button handles its own first press (otherwise touchend would start the
      // music and the click that follows would immediately mute it).
      if (event.target instanceof Element && event.target.closest("[data-sound-toggle]")) return;
      birthdayAudio.start();
      events.forEach((event) => window.removeEventListener(event, start));
    };
    events.forEach((event) => window.addEventListener(event, start));
    return () => events.forEach((event) => window.removeEventListener(event, start));
  }, []);
}

export default function SoundToggle() {
  const { started, muted } = useAudioState();
  const silent = !started || muted;
  useStartAudioOnFirstGesture();

  return (
    <div className="fixed left-3 top-3 z-[60] flex items-center gap-2 sm:left-4 sm:top-4">
      <motion.button
        type="button"
        data-sound-toggle
        onClick={() => birthdayAudio.toggleMute()}
        aria-label={silent ? "Play music" : "Mute music"}
        aria-pressed={!silent}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#2a1240]/70 text-white"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
          {silent ? (
            <path d="m22 9-6 6m0-6 6 6" />
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          )}
        </svg>
      </motion.button>
      <AnimatePresence>
        {!started && (
          <motion.span
            className="pointer-events-none rounded-full bg-[#2a1240]/70 px-3 py-1 text-xs text-white/80"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 2.4 } }}
            exit={{ opacity: 0, x: -6 }}
          >
            ♪ Tap for music
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
