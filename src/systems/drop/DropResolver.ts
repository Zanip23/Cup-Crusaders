// Summiert die TATSÄCHLICHEN Physik-Ergebnisse der Drop-Phase (ADR-009).
// Steuert nichts — wird von der Szene aufgerufen, wenn ein Ball physisch ein Tor
// passiert (Wert ändern) bzw. in einem Bin landet (Beitrag verbuchen).
// Reine Logik, testbar.

import type { BarKind, Effect } from '@/types/content';

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

/**
 * Wert-Wirkung eines Balkens (multiply / add / subtract). Nicht-wertende Balken
 * (bounce / breakable) lassen den Wert unverändert. Subtraktion ist bei 0
 * gekappt — ein Ball trägt nie einen negativen Wert.
 */
export function applyBarValue(value: number, kind: BarKind, amount = 0): number {
  switch (kind) {
    case 'multiply':
      return value * amount;
    case 'add':
      return value + amount;
    case 'subtract':
      return Math.max(0, value - amount);
    default:
      return value;
  }
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
