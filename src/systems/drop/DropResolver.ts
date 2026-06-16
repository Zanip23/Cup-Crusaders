// Summiert die TATSÄCHLICHEN Physik-Ergebnisse der Drop-Phase (ADR-009).
// Steuert nichts — wird von der Szene aufgerufen, wenn ein Ball physisch ein Tor
// passiert (Wert ändern) bzw. in einem Bin landet (Beitrag verbuchen).
// Reine Logik, testbar.

import type { Effect } from '@/types/content';

/** Wendet einen Tor-Effekt auf den Ball-Wert an (gateMultiply / gateAdd). */
export function applyGateEffect(value: number, effect: Effect): number {
  if (effect.type === 'gateMultiply') {
    return value * Number(effect.params.factor ?? 1);
  }
  if (effect.type === 'gateAdd') {
    return value + Number(effect.params.amount ?? 0);
  }
  return value;
}

/** Beitrag eines Balls in einem Bin = value × multiplier (docs/05). */
export function binContribution(value: number, multiplier: number): number {
  return value * multiplier;
}

export class DropResolver {
  private sum = 0;
  private resolved = 0;

  /** Verbucht einen in einem Bin gelandeten Ball. */
  collect(value: number, multiplier: number): number {
    const contribution = binContribution(value, multiplier);
    this.sum += contribution;
    this.resolved += 1;
    return contribution;
  }

  /** Verbucht einen despawnten/timeout-Ball (Mindestwert, docs/05 Timeout-Sicherung). */
  collectLost(minValue = 0): void {
    this.sum += minValue;
    this.resolved += 1;
  }

  total(): number {
    // Ganzzahlige Shop-Währung; gegen Float-Drift gerundet.
    return Math.round(this.sum);
  }

  resolvedCount(): number {
    return this.resolved;
  }
}
