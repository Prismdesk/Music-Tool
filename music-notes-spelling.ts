import type { Note, NoteLetter, NoteNamePreference } from "./music-notes-types";
import { mod12, NATURAL_PITCH_CLASSES, NOTE_LETTERS, accidentalFromOffset } from "./music-notes-pitch";

export function letterIndex(letter: NoteLetter): number {
  return NOTE_LETTERS.indexOf(letter);
}

export function letterAt(index: number): NoteLetter {
  return NOTE_LETTERS[mod7(index)];
}

function mod7(value: number): number {
  return ((value % 7) + 7) % 7;
}

const AUTO_SPELLING: Note[] = [
  { letter: "C", accidental: 0 }, { letter: "D", accidental: -1 }, { letter: "D", accidental: 0 }, { letter: "E", accidental: -1 },
  { letter: "E", accidental: 0 }, { letter: "F", accidental: 0 }, { letter: "F", accidental: 1 }, { letter: "G", accidental: 0 },
  { letter: "A", accidental: -1 }, { letter: "A", accidental: 0 }, { letter: "B", accidental: -1 }, { letter: "B", accidental: 0 }
];

/** Spell a pitch class. Natural notes always win; otherwise follow the preference ("automatic" uses common chord-root spellings). */
export function spellPitchClass(pitchClass: number, preference: NoteNamePreference = "automatic"): Note {
  const target = mod12(pitchClass);
  const natural = NOTE_LETTERS.find((letter) => NATURAL_PITCH_CLASSES[letter] === target);
  if (natural) return { letter: natural, accidental: 0 };
  if (preference === "automatic") return { ...AUTO_SPELLING[target] };
  const wanted = preference === "sharps" ? 1 : -1;
  for (const letter of NOTE_LETTERS) {
    if (mod12(NATURAL_PITCH_CLASSES[letter] + wanted) === target) return { letter, accidental: wanted as 1 | -1 };
  }
  return { ...AUTO_SPELLING[target] };
}

/** Common root spelling for a chord on this pitch class, e.g. Db major but C#m, Bb but A#... only where musicians expect it. */
export function spellChordRoot(pitchClass: number, minor = false): Note {
  const target = mod12(pitchClass);
  if (minor && [1, 6, 8].includes(target)) return spellPitchClass(target, "sharps");
  return spellPitchClass(target, "automatic");
}

export function noteForDegreeAndPitch(root: Note, degree: number, targetPitchClass: number): Note {
  const targetLetter = letterAt(letterIndex(root.letter) + (degree - 1));
  const base = NATURAL_PITCH_CLASSES[targetLetter];
  let offset = mod12(targetPitchClass - base);
  if (offset > 6) offset -= 12;
  if (offset < -2 || offset > 2) {
    throw new Error(`Cannot spell degree ${degree} of ${root.letter}: requires accidental ${offset}.`);
  }
  return { letter: targetLetter, accidental: accidentalFromOffset(offset) };
}

export function formatNote(note: Note): string {
  const accidental = ["bb", "b", "", "#", "##"][note.accidental + 2];
  return `${note.letter}${accidental}${note.octave ?? ""}`;
}
