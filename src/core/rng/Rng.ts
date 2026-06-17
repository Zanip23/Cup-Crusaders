// Seedbarer PRNG (mulberry32) — deterministisch & testbar (docs/09).
// Genutzt für Shop-Kartenziehung, Loot, Spawn-Varianz. NICHT für die
// physik-autoritative Drop-Phase (ADR-009).

export class Rng {
  private state: number;

  constructor(seed: number) {
    // 0 ist ein schlechter Seed für mulberry32 → auf >0 normalisieren.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [min, max] (inklusive). */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Wählt ein Element gewichtet aus. */
  weightedPick<T>(items: T[], weightOf: (item: T) => number): T {
    const total = items.reduce((sum, it) => sum + weightOf(it), 0);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= weightOf(it);
      if (roll < 0) return it;
    }
    return items[items.length - 1];
  }

  /** Erzeugt einen neuen, zufälligen Seed (für Run-Start). */
  static randomSeed(): number {
    // Kombiniere Timestamp + Math.random() für bessere Eindeutigkeit
    const timestamp = Date.now() & 0xffffff;
    const random = Math.random() * 0xffffff;
    return (timestamp ^ Math.floor(random)) >>> 0 || 0x9e3779b9;
  }
}
