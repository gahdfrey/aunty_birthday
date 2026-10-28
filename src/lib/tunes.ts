// The tunes the music box can play. All are public domain or original, so the site can use them freely.
// Melodies are [note, beats] with null for a rest; chords are one per bar as [bass, chord tones]
// (null for a bar with no chord).

export type Tune = {
  id: string;
  name: string;
  // A few words on how it feels, shown on the tune preview page.
  mood: string;
  bpm: number;
  beatsPerBar: number;
  // Beats before the first full bar, where the first chord lands.
  pickup: number;
  // Length of one pass of the tune, including any breath before it repeats.
  loopBeats: number;
  // Multiplies the written pitch: 2 plays it an octave higher.
  octave: number;
  // Plays every other pass an octave higher, like a second music box joining in.
  alternateOctave: boolean;
  melody: [string | null, number][];
  chords: ([string, string[]] | null)[];
};

const C: [string, string[]] = ["C3", ["E3", "G3", "C4"]];
const F: [string, string[]] = ["F2", ["F3", "A3", "C4"]];
const G: [string, string[]] = ["G2", ["G3", "B3", "D4"]];

// prettier-ignore
export const TUNES: Tune[] = [
  {
    id: "happy-birthday",
    name: "Happy Birthday",
    mood: "The classic birthday song, as a music box",
    bpm: 88, beatsPerBar: 3, pickup: 1, loopBeats: 27, octave: 1, alternateOctave: true,
    melody: [
      ["D4", 0.75], ["D4", 0.25], ["E4", 1], ["D4", 1], ["G4", 1], ["F#4", 2],
      ["D4", 0.75], ["D4", 0.25], ["E4", 1], ["D4", 1], ["A4", 1], ["G4", 2],
      ["D4", 0.75], ["D4", 0.25], ["D5", 1], ["B4", 1], ["G4", 1], ["F#4", 1], ["E4", 1],
      ["C5", 0.75], ["C5", 0.25], ["B4", 1], ["G4", 1], ["A4", 1], ["G4", 3],
    ],
    chords: [
      G, ["D3", ["F#3", "A3", "D4"]], ["D3", ["F#3", "A3", "C4"]], G,
      G, ["C3", ["G3", "C4", "E4"]], ["D3", ["G3", "B3", "D4"]], G,
    ],
  },
  {
    id: "brahms-lullaby",
    name: "Brahms' Lullaby",
    mood: "Tender and warm, like a hug",
    bpm: 72, beatsPerBar: 3, pickup: 1, loopBeats: 51, octave: 1, alternateOctave: true,
    melody: [
      ["E4", 0.5], ["E4", 0.5],
      ["G4", 2], ["E4", 0.5], ["E4", 0.5],
      ["G4", 2], ["E4", 0.5], ["G4", 0.5],
      ["C5", 1], ["B4", 1.5], ["A4", 0.5],
      ["A4", 1], ["G4", 1], ["D4", 0.5], ["E4", 0.5],
      ["F4", 1], ["D4", 1], ["D4", 0.5], ["E4", 0.5],
      ["F4", 2], ["D4", 0.5], ["F4", 0.5],
      ["B4", 0.5], ["A4", 0.5], ["G4", 1], ["B4", 1],
      ["C5", 2], ["C4", 0.5], ["C4", 0.5],
      ["C5", 2], ["A4", 0.5], ["F4", 0.5],
      ["G4", 2], ["E4", 0.5], ["C4", 0.5],
      ["F4", 1], ["G4", 1], ["A4", 1],
      ["G4", 2], ["C4", 0.5], ["C4", 0.5],
      ["C5", 2], ["A4", 0.5], ["F4", 0.5],
      ["G4", 2], ["E4", 0.5], ["C4", 0.5],
      ["F4", 1], ["E4", 1], ["D4", 1],
      ["C4", 3],
    ],
    chords: [C, C, F, C, G, G, G, C, F, C, F, C, F, C, G, C],
  },
  {
    id: "ode-to-joy",
    name: "Ode to Joy",
    mood: "Bright and joyful, a real celebration",
    bpm: 104, beatsPerBar: 4, pickup: 0, loopBeats: 66, octave: 2, alternateOctave: false,
    melody: [
      ["E4", 1], ["E4", 1], ["F4", 1], ["G4", 1],
      ["G4", 1], ["F4", 1], ["E4", 1], ["D4", 1],
      ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
      ["E4", 1.5], ["D4", 0.5], ["D4", 2],
      ["E4", 1], ["E4", 1], ["F4", 1], ["G4", 1],
      ["G4", 1], ["F4", 1], ["E4", 1], ["D4", 1],
      ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
      ["D4", 1.5], ["C4", 0.5], ["C4", 2],
      ["D4", 1], ["D4", 1], ["E4", 1], ["C4", 1],
      ["D4", 1], ["E4", 0.5], ["F4", 0.5], ["E4", 1], ["C4", 1],
      ["D4", 1], ["E4", 0.5], ["F4", 0.5], ["E4", 1], ["D4", 1],
      ["C4", 1], ["D4", 1], ["G3", 2],
      ["E4", 1], ["E4", 1], ["F4", 1], ["G4", 1],
      ["G4", 1], ["F4", 1], ["E4", 1], ["D4", 1],
      ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
      ["D4", 1.5], ["C4", 0.5], ["C4", 2],
    ],
    chords: [C, G, C, G, C, G, C, C, G, G, G, G, C, G, C, C],
  },
  {
    id: "canon-in-d",
    name: "Canon in D",
    mood: "Elegant and emotional, made for the letter",
    bpm: 64, beatsPerBar: 2, pickup: 0, loopBeats: 48, octave: 1, alternateOctave: false,
    melody: [
      ["F#5", 2], ["E5", 2], ["D5", 2], ["C#5", 2], ["B4", 2], ["A4", 2], ["B4", 2], ["C#5", 2],
      ["D5", 2], ["C#5", 2], ["B4", 2], ["A4", 2], ["G4", 2], ["F#4", 2], ["G4", 2], ["E4", 2],
      ["F#5", 1], ["A5", 1], ["E5", 1], ["C#5", 1], ["D5", 1], ["F#5", 1], ["C#5", 1], ["A4", 1],
      ["B4", 1], ["D5", 1], ["A4", 1], ["F#4", 1], ["G4", 1], ["B4", 1], ["A4", 1], ["C#5", 1],
    ],
    chords: Array.from({ length: 3 }, () => [
      ["D3", ["D3", "F#3", "A3"]], ["A2", ["A3", "C#4", "E4"]], ["B2", ["B3", "D4", "F#4"]],
      ["F#2", ["F#3", "A3", "C#4"]], ["G2", ["G3", "B3", "D4"]], ["D3", ["D3", "F#3", "A3"]],
      ["G2", ["G3", "B3", "D4"]], ["A2", ["A3", "C#4", "E4"]],
    ] as [string, string[]][]).flat(),
  },
  {
    id: "fur-elise",
    name: "Für Elise",
    mood: "A timeless classic, sweet and a little nostalgic",
    // Counted in eighth notes.
    bpm: 168, beatsPerBar: 3, pickup: 1, loopBeats: 37, octave: 1, alternateOctave: false,
    melody: [
      ["E5", 0.5], ["D#5", 0.5],
      ["E5", 0.5], ["D#5", 0.5], ["E5", 0.5], ["B4", 0.5], ["D5", 0.5], ["C5", 0.5],
      ["A4", 1.5], ["C4", 0.5], ["E4", 0.5], ["A4", 0.5],
      ["B4", 1.5], ["E4", 0.5], ["G#4", 0.5], ["B4", 0.5],
      ["C5", 1.5], ["E4", 0.5], ["E5", 0.5], ["D#5", 0.5],
      ["E5", 0.5], ["D#5", 0.5], ["E5", 0.5], ["B4", 0.5], ["D5", 0.5], ["C5", 0.5],
      ["A4", 1.5], ["C4", 0.5], ["E4", 0.5], ["A4", 0.5],
      ["B4", 1.5], ["E4", 0.5], ["C5", 0.5], ["B4", 0.5],
      ["A4", 1.5], ["B4", 0.5], ["C5", 0.5], ["D5", 0.5],
      ["E5", 1.5], ["G4", 0.5], ["F5", 0.5], ["E5", 0.5],
      ["D5", 1.5], ["F4", 0.5], ["E5", 0.5], ["D5", 0.5],
      ["C5", 1.5], ["E4", 0.5], ["D5", 0.5], ["C5", 0.5],
      ["B4", 1.5], ["E4", 0.5], ["E5", 1],
    ],
    chords: [
      null, ["A2", ["A3", "C4", "E4"]], ["E2", ["E3", "G#3", "B3"]], ["A2", ["A3", "C4", "E4"]],
      null, ["A2", ["A3", "C4", "E4"]], ["E2", ["E3", "G#3", "B3"]], ["A2", ["A3", "C4", "E4"]],
      C, G, ["A2", ["A3", "C4", "E4"]], ["E2", ["E3", "G#3", "B3"]],
    ],
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    mood: "An original waltz written for Aunty Rita: light, happy and a little sentimental",
    bpm: 100, beatsPerBar: 3, pickup: 0, loopBeats: 51, octave: 1, alternateOctave: true,
    melody: [
      ["A4", 1], ["C5", 1], ["F5", 1],
      ["E5", 1.5], ["D5", 0.5], ["A4", 1],
      ["D5", 1], ["C5", 1], ["A#4", 1],
      ["G4", 2], ["C5", 1],
      ["A4", 1], ["C5", 1], ["F5", 1],
      ["G5", 1.5], ["F5", 0.5], ["E5", 1],
      ["D5", 1], ["F5", 1], ["D5", 1],
      ["C5", 3],
      ["F5", 1], ["E5", 1], ["F5", 1],
      ["A5", 1.5], ["G5", 0.5], ["F5", 1],
      ["D5", 1], ["G5", 1], ["F5", 1],
      ["E5", 2], ["C5", 1],
      ["A4", 1], ["C5", 1], ["F5", 1],
      ["D5", 1.5], ["F5", 0.5], ["D5", 1],
      ["E5", 1], ["G5", 1], ["E5", 1],
      ["F5", 3],
    ],
    chords: [
      F, ["D3", ["D3", "F3", "A3"]], ["A#2", ["A#3", "D4", "F4"]], ["C3", ["E3", "G3", "C4"]],
      F, ["A2", ["A3", "C4", "E4"]], ["A#2", ["A#3", "D4", "F4"]], ["C3", ["E3", "G3", "A#3"]],
      F, ["D3", ["D3", "F3", "A3"]], ["G2", ["G3", "A#3", "D4"]], ["C3", ["E3", "G3", "C4"]],
      F, ["A#2", ["A#3", "D4", "F4"]], ["C3", ["E3", "G3", "A#3"]], F,
    ],
  },
];

export const DEFAULT_TUNE_ID = "golden-hour";

// prettier-ignore
const NOTE_OFFSETS: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export function frequency(note: string) {
  const match = /^([A-G]#?)(\d)$/.exec(note)!;
  const midi = NOTE_OFFSETS[match[1]] + (Number(match[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// A tune's melody and chords merged into one timeline, in beats from the start of a pass.
export type MusicEvent = { beat: number; melody?: string; chord?: [string, string[]] };

export function musicEvents(tune: Tune): MusicEvent[] {
  const events: MusicEvent[] = [];
  let beat = 0;
  tune.melody.forEach(([note, beats]) => {
    if (note) events.push({ beat, melody: note });
    beat += beats;
  });
  tune.chords.forEach((chord, bar) => {
    if (chord) events.push({ beat: tune.pickup + bar * tune.beatsPerBar, chord });
  });
  return events.sort((a, b) => a.beat - b.beat);
}
