// All sound on the page, synthesized live with the Web Audio API: a music-box "Happy Birthday"
// loop plus a few effects. Nothing to download, and it runs on the audio thread, off the main
// thread that drives the animations.

// prettier-ignore
const NOTE_OFFSETS: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

function frequency(note: string) {
  const match = /^([A-G]#?)(\d)$/.exec(note)!;
  const midi = NOTE_OFFSETS[match[1]] + (Number(match[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// The traditional "Happy Birthday" melody in G major, as [note, beats]. It starts on a one-beat pickup.
// prettier-ignore
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

// The melody and chords merged into one timeline, in beats from the start of a pass.
type MusicEvent = { beat: number; melody?: string; chord?: [string, string[]] };
const MUSIC_EVENTS: MusicEvent[] = (() => {
  const events: MusicEvent[] = [];
  let beat = 0;
  MELODY.forEach(([note, beats]) => {
    events.push({ beat, melody: note });
    beat += beats;
  });
  CHORDS.forEach((chord, bar) => events.push({ beat: 1 + bar * 3, chord }));
  return events.sort((a, b) => a.beat - b.beat);
})();

export type AudioState = { started: boolean; muted: boolean };

function readMutedPreference() {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

type Grain = { at: number; duration: number; freq: number; q: number; peak: number; pan: number };

// Renders short bursts of band-passed noise into a stereo buffer: each grain is white noise through
// a band-pass filter (the same design Web Audio's BiquadFilterNode uses), shaped by a quick attack
// and decay, and placed in the stereo field with an equal-power pan.
function renderGrains(ctx: BaseAudioContext, grains: Grain[]) {
  const rate = ctx.sampleRate;
  const end = Math.max(...grains.map((grain) => grain.at + grain.duration));
  const buffer = ctx.createBuffer(2, Math.ceil(end * rate) + 1, rate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  grains.forEach(({ at, duration, freq, q, peak, pan }) => {
    const w0 = (2 * Math.PI * freq) / rate;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    const angle = ((pan + 1) * Math.PI) / 4;
    const leftLevel = Math.cos(angle) * peak;
    const rightLevel = Math.sin(angle) * peak;
    const length = Math.round(duration * rate);
    const attack = Math.max(1, Math.round(Math.min(0.002, duration / 3) * rate));
    const offset = Math.round(at * rate);
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    for (let i = 0; i < length; i++) {
      const x = Math.random() * 2 - 1;
      const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      const envelope = i < attack ? i / attack : Math.exp((-7 * (i - attack)) / (length - attack));
      left[offset + i] += y * envelope * leftLevel;
      right[offset + i] += y * envelope * rightLevel;
    }
  });
  return buffer;
}

class BirthdayAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private brownNoise!: AudioBuffer;
  private effects!: GainNode;
  // Where effect sounds are sent while they're being built: the effects bus, or a per-effect
  // channel when the effect needs to be cancellable.
  private out!: AudioNode;
  private loopStart = 0;
  private loopCount = 0;
  private nextEvent = 0;
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

  // Builds the whole audio engine silently, without playing anything. It doesn't need a tap, so it
  // runs in the background once the page has settled; the first tap then only has to press play.
  prepare() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    // Lets the music play on iPhones even when the ring/silent switch is on silent.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";

    // Starts out suspended (silent) until a tap resumes it.
    const ctx = new AudioContextClass();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // A limiter on the final output, so layered sounds can never clip and distort.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    this.master.connect(limiter).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.createImpulse(1.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_VOLUME;
    this.music.connect(this.master);
    this.music.connect(this.reverb);

    this.noise = this.createNoise();
    this.brownNoise = this.createBrownNoise();
    // Effects skip the music volume, so they stay clear even while the music is ducked, and get
    // just a touch of room echo, so they sound like they're in the same space as the music.
    this.effects = ctx.createGain();
    this.effects.connect(this.master);
    this.out = this.effects;
    const effectsReverb = ctx.createGain();
    effectsReverb.gain.value = 0.4;
    this.effects.connect(effectsReverb).connect(this.reverb);
  }

  // Must be called from a user gesture (tap, click, key): browsers keep audio locked until then.
  start() {
    if (this.state.started) {
      if (this.ctx?.state === "suspended" && !document.hidden) this.ctx.resume();
      return;
    }
    // Normally already done in the background; this only does the work here if the visitor
    // tapped before it had a chance to run.
    this.prepare();
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.resume();

    const muted = readMutedPreference();
    // Fade in rather than starting abruptly.
    if (!muted) this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.loopStart = ctx.currentTime + 0.3;
    window.setInterval(() => this.scheduleMusic(), 150);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });

    this.setState({ started: true, muted });
  }

  toggleMute() {
    const ctx = this.ctx;
    if (!this.state.started || !ctx) {
      // The first press of the button also unlocks audio, and should always mean "play".
      this.writeMutedPreference(false);
      this.start();
      return;
    }
    const muted = !this.state.muted;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, muted ? 0.08 : 0.3);
    this.writeMutedPreference(muted);
    this.setState({ muted });
  }

  // Lowers the music while a wish is being made, then brings it back, optionally after `delay` seconds.
  duck(on: boolean, delay = 0) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(
      on ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME,
      this.ctx.currentTime + delay,
      on ? 0.4 : 0.8,
    );
  }

  // A breath across the candles, the flames fluttering out, then a party popper and a
  // shower of paper confetti settling. Built from layered, shaped noise rather than tones,
  // because that's what these sounds are made of in real life.
  //
  // Pass `delay` to schedule it ahead on the audio clock: building it early, while nothing else
  // is happening, keeps that work off the busy moment when the candles actually go out.
  // Returns a function that cancels it, if it hasn't played yet.
  blowOut(delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return () => {};
    const t = ctx.currentTime + delay;
    // Its own channel, so cancelling is just disconnecting it.
    const channel = ctx.createGain();
    channel.connect(this.effects);
    this.out = channel;

    // The breath: band-limited noise that swells and fades, with turbulence in its level.
    this.noiseBurst(t, 0.85, {
      filters: [
        ["highpass", 180, 0.7],
        ["lowpass", 1700, 0.7],
      ],
      peak: 0.55,
      attack: 0.14,
      grit: 0.35,
    });
    // Each flame fluttering out: tiny low puffs as the breath passes over the candles.
    for (let i = 0; i < 5; i++) {
      this.noiseBurst(t + 0.18 + i * 0.07 + Math.random() * 0.03, 0.09, {
        filters: [["lowpass", 500 + Math.random() * 300, 1]],
        peak: 0.25,
        attack: 0.01,
      });
    }

    // The popper: a sharp crack with a low thump under it.
    const pop = t + 0.62;
    this.noiseBurst(pop, 0.06, { filters: [["highpass", 900, 0.7]], peak: 0.5, attack: 0.001 });
    this.thump(pop, 190, 55, 0.32, 0.12);
    this.noiseBurst(pop + 0.005, 0.3, { filters: [["bandpass", 2200, 0.8]], peak: 0.22, attack: 0.004 });

    // Paper confetti: lots of tiny, randomly placed rustles, dense at first and thinning out.
    this.paperRustle(pop + 0.04, 2.6, 160);

    this.out = this.effects;
    return () => channel.disconnect();
  }

  // A match: the gritty scrape of the head on the strip, the flare as it catches,
  // then the wicks catching one after another and a soft flame hiss.
  light() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // The scrape, rising in pitch as the match is dragged, with crackles from the friction.
    this.noiseBurst(t, 0.2, {
      filters: [["bandpass", 2600, 1.1]],
      sweepTo: 4800,
      peak: 0.4,
      attack: 0.012,
      grit: 0.6,
    });
    this.crackle(t, 0.2, 18, 0.45);

    // The flare: a bright bloom of noise that opens up and settles, with a little body under it.
    const flare = t + 0.18;
    this.noiseBurst(flare, 0.7, {
      filters: [["lowpass", 700, 0.8]],
      sweepTo: 3800,
      sweepTime: 0.05,
      settleTo: 900,
      peak: 0.6,
      attack: 0.015,
    });
    this.thump(flare, 130, 60, 0.22, 0.2);
    this.crackle(flare + 0.05, 0.7, 22, 0.3);

    // The wicks catching, one soft puff per candle.
    for (let i = 0; i < 5; i++) {
      this.noiseBurst(flare + 0.35 + i * 0.11 + Math.random() * 0.04, 0.22, {
        filters: [["lowpass", 450, 0.9]],
        sweepTo: 1200,
        peak: 0.2,
        attack: 0.03,
      });
    }

    // The flames' quiet hiss, fading away.
    this.noiseBurst(flare + 0.3, 1.4, {
      filters: [["bandpass", 700, 0.5]],
      peak: 0.1,
      attack: 0.2,
      source: this.brownNoise,
    });
  }

  // A look-ahead scheduler: every 150 ms it queues just the notes due in the next half second,
  // so it only ever builds a few audio nodes at a time instead of a whole pass of the tune at once.
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (;;) {
      const event = MUSIC_EVENTS[this.nextEvent];
      const at = this.loopStart + event.beat * BEAT;
      if (at > ctx.currentTime + 0.5) break;
      // Muted: keep time without building any sound.
      if (!this.state.muted && at > ctx.currentTime - 0.05) {
        // Every other pass is an octave higher, like a second music box joining in.
        if (event.melody)
          this.musicBoxNote(at, frequency(event.melody) * (this.loopCount % 2 === 1 ? 2 : 1), 0.22);
        if (event.chord) {
          const [bass, tones] = event.chord;
          this.pad(at, frequency(bass), 3 * BEAT, 0.12);
          tones.forEach((tone) => this.pad(at, frequency(tone), 3 * BEAT, 0.035));
        }
      }
      this.nextEvent += 1;
      if (this.nextEvent === MUSIC_EVENTS.length) {
        this.nextEvent = 0;
        this.loopStart += LOOP_BEATS * BEAT;
        this.loopCount += 1;
      }
    }
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

  // A shaped burst of noise through one or more filters.
  private noiseBurst(
    at: number,
    duration: number,
    options: {
      filters: [BiquadFilterType, number, number][];
      peak: number;
      attack: number;
      // Sweeps the first filter's frequency to this value...
      sweepTo?: number;
      // ...over this many seconds (the whole burst by default)...
      sweepTime?: number;
      // ...and then glides it to this value for the rest of the burst.
      settleTo?: number;
      // How much random wobble to put in the level: turbulence for breath, roughness for scraping.
      grit?: number;
      source?: AudioBuffer;
    },
  ) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = options.source ?? this.noise;
    let node: AudioNode = source;
    options.filters.forEach(([type, freq, q], i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(freq, at);
      if (i === 0 && options.sweepTo) {
        const sweepEnd = at + (options.sweepTime ?? duration);
        filter.frequency.exponentialRampToValueAtTime(options.sweepTo, sweepEnd);
        if (options.settleTo) filter.frequency.exponentialRampToValueAtTime(options.settleTo, at + duration);
      }
      node = node.connect(filter);
    });

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(options.peak, at + options.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    node.connect(gain).connect(this.out);

    if (options.grit) {
      // Slowly varying noise added onto the level, so it wobbles like real air or friction.
      const wobble = ctx.createBufferSource();
      wobble.buffer = this.noise;
      const smooth = ctx.createBiquadFilter();
      smooth.type = "lowpass";
      smooth.frequency.value = 40;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(options.peak * options.grit * 4, at + options.attack);
      depth.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      wobble.connect(smooth).connect(depth).connect(gain.gain);
      wobble.start(at, Math.random() * 0.5);
      wobble.stop(at + duration);
    }

    // Start at a random point in the noise so repeated effects never sound identical.
    source.start(at, Math.random() * 0.5);
    source.stop(at + duration + 0.02);
  }

  // A short pitched drop that gives a pop or flare some weight.
  private thump(at: number, from: number, to: number, peak: number, duration: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.out);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  // Tiny, sharp clicks scattered over a span of time, like a match head or a flame crackling.
  private crackle(at: number, span: number, count: number, peak: number) {
    this.playGrains(
      at,
      Array.from({ length: count }, () => ({
        at: Math.random() ** 1.5 * span,
        duration: 0.002 + Math.random() * 0.005,
        freq: 2500 + Math.random() * 5000,
        q: 2,
        peak: peak * (0.3 + Math.random() * 0.7),
        pan: (Math.random() - 0.5) * 0.4,
      })),
    );
  }

  // Many soft paper flutters spread across the stereo field, dense at first and thinning out
  // as the confetti settles.
  private paperRustle(at: number, span: number, count: number) {
    this.playGrains(
      at,
      Array.from({ length: count }, () => {
        const progress = Math.random() ** 1.8;
        return {
          at: progress * span,
          duration: 0.004 + Math.random() * 0.018,
          freq: 1200 + Math.random() * 5000,
          q: 1.4,
          peak: (0.05 + Math.random() * 0.16) * (1 - progress * 0.8),
          pan: Math.random() * 1.6 - 0.8,
        };
      }),
    );
  }

  // Grains are computed straight into one clip rather than built from audio nodes: a few
  // milliseconds of maths instead of hundreds of nodes, which would stall the animations.
  private playGrains(at: number, grains: Grain[]) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = renderGrains(ctx, grains);
    source.connect(this.out);
    source.start(at);
  }

  private createNoise() {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Noise with most of its energy in the low end: a soft rumble rather than a bright hiss.
  private createBrownNoise() {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  // A synthetic room echo: two channels of noise that fade out over `seconds`.
  private createImpulse(seconds: number) {
    const ctx = this.ctx!;
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    // Exponential fade, computed with one multiply per sample.
    const decay = Math.exp(Math.log(0.001) / length);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let level = 1;
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * level;
        level *= decay;
      }
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
