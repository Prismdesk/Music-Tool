import type { ChordDefinition } from "./music-chords-types";
import { CHORD_DEFINITIONS } from "./music-chords-definitions";

export class ChordRegistry {
  private readonly definitions = new Map(CHORD_DEFINITIONS.map((definition) => [definition.id, definition]));

  get(id: string): ChordDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown chord definition: ${id}`);
    return definition;
  }

  all(): ChordDefinition[] {
    return [...this.definitions.values()];
  }

  findByName(query: string): ChordDefinition[] {
    const normalized = query.trim().toLowerCase();
    return this.all().filter((d) => d.name.toLowerCase() === normalized || d.aliases.some((a) => a.toLowerCase() === normalized));
  }
}

export const chordRegistry = new ChordRegistry();
