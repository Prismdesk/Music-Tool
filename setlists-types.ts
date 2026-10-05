export interface SetlistEntry {
  id: string;
  songId: string;
  order: number;
  /** Semitones to play this song higher/lower than the song as written (stacked on the song's own transposition). */
  transpose?: number;
  capoOverride?: number;
  tempoOverride?: number;
  /** Start performing from this section instead of the top. */
  startingSectionId?: string;
  notes?: string;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  location?: string;
  notes?: string;
  entries: SetlistEntry[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}
