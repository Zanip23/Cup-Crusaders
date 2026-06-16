// Eine einzige Wahrheit für alle Zahlen (docs/08 §1.4). Phaser-entkoppelt, testbar.
//
// Berechnungsreihenfolge (kanonisch, docs/08 §1.3):
//   final = ( base + Σ flat ) × ( 1 + Σ percentAdd ) × Π ( percentMult )
// danach Clamp gegen STAT_CAPS (ADR-010).

import type { Modifier, ModifierScope } from './StatTypes';
import { StatKey, STAT_CAPS } from './StatTypes';

export class StatEngine {
  private base = new Map<StatKey, number>();
  private modifiers: Modifier[] = [];
  private cache = new Map<StatKey, number>();

  setBase(stats: Partial<Record<StatKey, number>>): void {
    for (const [k, v] of Object.entries(stats)) {
      if (v !== undefined) this.base.set(k as StatKey, v);
    }
    this.invalidate();
  }

  addModifier(m: Modifier): void {
    this.modifiers.push(m);
    this.invalidate();
  }

  removeBySource(sourceId: string): void {
    this.modifiers = this.modifiers.filter((m) => m.sourceId !== sourceId);
    this.invalidate();
  }

  clearScope(scope: ModifierScope): void {
    this.modifiers = this.modifiers.filter((m) => m.scope !== scope);
    this.invalidate();
  }

  /** Entfernt abgelaufene buff-Modifier (expiresAt <= now). */
  pruneExpired(now: number): void {
    const before = this.modifiers.length;
    this.modifiers = this.modifiers.filter((m) => m.expiresAt === undefined || m.expiresAt > now);
    if (this.modifiers.length !== before) this.invalidate();
  }

  get(stat: StatKey): number {
    const cached = this.cache.get(stat);
    if (cached !== undefined) return cached;
    const value = this.compute(stat);
    this.cache.set(stat, value);
    return value;
  }

  snapshot(): Record<StatKey, number> {
    const out = {} as Record<StatKey, number>;
    for (const key of Object.values(StatKey)) out[key] = this.get(key);
    return out;
  }

  private compute(stat: StatKey): number {
    const base = this.base.get(stat) ?? 0;
    let flat = 0;
    let percentAdd = 0;
    let percentMult = 1;
    for (const m of this.modifiers) {
      if (m.stat !== stat) continue;
      if (m.op === 'flat') flat += m.value;
      else if (m.op === 'percentAdd') percentAdd += m.value;
      else percentMult *= m.value;
    }
    let value = (base + flat) * (1 + percentAdd) * percentMult;
    const cap = STAT_CAPS[stat];
    if (cap !== undefined) value = Math.min(value, cap);
    // Unterschranke: kein Stat wird negativ (große negative Modifier abfangen).
    return Math.max(0, value);
  }

  private invalidate(): void {
    this.cache.clear();
  }
}
