"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { birthdayAudio } from "@/lib/birthdayAudio";
import { DEFAULT_TUNE_ID, TUNES } from "@/lib/tunes";

// Lets you listen to each tune the music box can play, to choose the one for the birthday page.
export default function TunePicker() {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (playingId === id) {
      birthdayAudio.stopMusic();
      setPlayingId(null);
      return;
    }
    // This tap also unlocks audio. Previewing should always be audible, without changing the
    // mute setting saved for the birthday page itself.
    birthdayAudio.start();
    birthdayAudio.setMuted(false, false);
    birthdayAudio.playTune(id);
    setPlayingId(id);
  };

  return (
    <main className="min-h-dvh w-full bg-[radial-gradient(ellipse_at_top,#4a1d5e_0%,#1d0b2e_55%,#0d0618_100%)] px-4 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-pink-200/80">For the birthday page</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Pick the music</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
          Tap play to hear each tune on the music box. It loops until you stop it or play another.
        </p>

        <ul className="mt-8 space-y-3">
          {TUNES.map((tune, i) => {
            const playing = playingId === tune.id;
            return (
              <motion.li
                key={tune.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                  playing ? "border-pink-300/60 bg-white/10" : "border-white/10 bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(tune.id)}
                  aria-label={playing ? `Stop ${tune.name}` : `Play ${tune.name}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400 shadow-lg shadow-pink-500/30 transition-transform active:scale-95"
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg sm:text-xl">
                      {i + 1}. {tune.name}
                    </h2>
                    {tune.id === DEFAULT_TUNE_ID && (
                      <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-amber-100">
                        On the site now
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-white/65">{tune.mood}</p>
                </div>
                {playing && (
                  <div className="flex h-5 items-end gap-0.5" aria-hidden>
                    {[0, 1, 2].map((bar) => (
                      <motion.span
                        key={bar}
                        className="w-1 rounded-full bg-pink-300"
                        animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: bar * 0.18, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
