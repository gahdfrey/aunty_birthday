// All sound on the page, synthesized live with the Web Audio API: a music-box "Happy Birthday"
// loop plus a few effects. Nothing to download, and it runs on the audio thread, off the main
// thread that drives the animations.

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

function frequency(note: string) {
  const match = /^([A-G]#?)(\d)$/.exec(note)!;
  const midi = NOTE_OFFSETS[match[1]] + (Number(match[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// The traditional "Happy Birthday" melody in G major, as [note, beats]. It starts on a one-beat pickup.
const MELODY: [string, number][] = [
  ["D4", 0.75], ["D4", 0.25], ["E4", 1], ["D4", 1], ["G4", 1], ["F#4", 2],
  ["D4", 0.75], ["D4", 0.25], ["E4", 1], ["D4", 1], ["A4", 1], ["G4", 2],
  ["D4", 0.75], ["D4", 0.25], ["D5", 1], ["B4", 1], ["G4", 1], ["F#4", 1], ["E4", 1],
  ["C5", 0.75], ["C5", 0.25], ["B4", 1], ["G4", 1], ["A4", 1], ["G4", 3],
];

// One chord per 3/4 bar, starting after the pickup beat: [bass, chord tones].
const CHORDS: [string, string[]][] = [
  ["G2", ["G3", "B3", "D4"]],
  ["D3", ["F#3", "A3", "D4"]],
  ["D3", ["F#3", "A3", "C4"]],
  ["G2", ["G3", "B3", "D4"]],
  ["G2", ["G3", "B3", "D4"]],
  ["C3", ["G3", "C4", "E4"]],
  ["D3", ["G3", "B3", "D4"]],
  ["G2", ["G3", "B3", "D4"]],
];

const BEAT = 60 / 88;
// 25 beats of melody plus a two-beat breath before it comes round again.
const LOOP_BEATS = 27;
const MUSIC_VOLUME = 0.32;
const MUTED_KEY = "birthday-music-muted";

export type AudioState = { started: boolean; muted: boolean };

function readMutedPreference() {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

class BirthdayAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private nextLoopAt = 0;
  private loopCount = 0;
  private listeners = new Set<() => void>();
  private state: AudioState = { started: false, muted: false };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private setState(next: Partial<AudioState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  // Must be called from a user gesture (tap, click, key): browsers keep audio locked until then.
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume();
      return;
    }
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    // Lets the music play on iPhones even when the ring/silent switch is on silent.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";

    const ctx = new AudioContextClass();
    this.ctx = ctx;
    const muted = readMutedPreference();

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.createImpulse(2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_VOLUME;
    this.music.connect(this.master);
    this.music.connect(this.reverb);

    this.noise = this.createNoise();
    ctx.resume();

    // Fade in rather than starting abruptly.
    if (!muted) this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.nextLoopAt = ctx.currentTime + 0.3;
    this.scheduleMusic();
    window.setInterval(() => this.scheduleMusic(), 1000);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });

    this.setState({ started: true, muted });
  }

  toggleMute() {
    if (!this.ctx) {
      // The first press of the button also unlocks audio, and should always mean "play".
      this.writeMutedPreference(false);
      this.start();
      return;
    }
    const muted = !this.state.muted;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, muted ? 0.08 : 0.3);
    this.writeMutedPreference(muted);
    this.setState({ muted });
  }

  // Lowers the music while a wish is being made, then brings it back.
  duck(on: boolean) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME, this.ctx.currentTime, on ? 0.4 : 0.8);
  }

  // A breath of air across the candles, then a sparkle as the wish is sent off.
  blowOut() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const source = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(350, t + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.9, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + 1.05);

    ["G5", "B5", "D6", "G6", "B6"].forEach((note, i) => this.bell(t + 0.45 + i * 0.08, frequency(note), 0.16));
  }

  // A match strike followed by the soft whoomp of the flames catching.
  light() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const strike = this.noiseSource();
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 2500;
    const strikeGain = ctx.createGain();
    strikeGain.gain.setValueAtTime(0, t);
    strikeGain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    strike.connect(high).connect(strikeGain).connect(this.master);
    strike.start(t);
    strike.stop(t + 0.2);

    const flame = this.noiseSource();
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(200, t + 0.12);
    low.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
    const flameGain = ctx.createGain();
    flameGain.gain.setValueAtTime(0, t + 0.12);
    flameGain.gain.linearRampToValueAtTime(0.45, t + 0.3);
    flameGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    flame.connect(low).connect(flameGain).connect(this.master);
    flame.start(t + 0.12);
    flame.stop(t + 0.95);

    this.bell(t + 0.3, frequency("D5"), 0.1);
    this.bell(t + 0.42, frequency("G5"), 0.1);
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    // Queue the next pass of the tune a couple of seconds before the current one ends.
    while (this.nextLoopAt < ctx.currentTime + 2) {
      // Every other pass is an octave higher, like a second music box joining in.
      this.scheduleLoop(this.nextLoopAt, this.loopCount % 2 === 1 ? 2 : 1);
      this.nextLoopAt += LOOP_BEATS * BEAT;
      this.loopCount += 1;
    }
  }

  private scheduleLoop(start: number, octave: number) {
    let beat = 0;
    MELODY.forEach(([note, beats]) => {
      this.musicBoxNote(start + beat * BEAT, frequency(note) * octave, 0.22);
      beat += beats;
    });
    CHORDS.forEach(([bass, tones], bar) => {
      const at = start + (1 + bar * 3) * BEAT;
      this.pad(at, frequency(bass), 3 * BEAT, 0.12);
      tones.forEach((tone) => this.pad(at, frequency(tone), 3 * BEAT, 0.035));
    });
  }

  private musicBoxNote(at: number, freq: number, volume: number) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
    gain.connect(this.music);
    [
      [1, 1],
      [2.0, 0.22],
      [3.01, 0.06],
    ].forEach(([ratio, level]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const partial = ctx.createGain();
      partial.gain.value = level;
      osc.connect(partial).connect(gain);
      osc.start(at);
      osc.stop(at + 1.85);
    });
  }

  private pad(at: number, freq: number, duration: number, volume: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.25);
    gain.gain.setValueAtTime(volume, at + duration - 0.2);
    gain.gain.linearRampToValueAtTime(0, at + duration + 0.3);
    osc.connect(filter).connect(gain).connect(this.music);
    osc.start(at);
    osc.stop(at + duration + 0.35);
  }

  // Sound effects go straight to the master volume, so they stay clear even while the music is ducked.
  private bell(at: number, freq: number, volume: number) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    gain.connect(this.master);
    gain.connect(this.reverb);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + 1.45);
  }

  private noiseSource() {
    const source = this.ctx!.createBufferSource();
    source.buffer = this.noise;
    return source;
  }

  private createNoise() {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // A synthetic room echo: two channels of noise that fade out over `seconds`.
  private createImpulse(seconds: number) {
    const ctx = this.ctx!;
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }

  private writeMutedPreference(muted: boolean) {
    try {
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      // Private browsing can block storage; the toggle still works for this visit.
    }
  }
}

export const birthdayAudio = new BirthdayAudio();
