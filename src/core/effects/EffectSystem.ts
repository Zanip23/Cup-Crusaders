// Effekt-/Komponenten-System (docs/08 §2). Verhalten als komponierbare Daten.
// M2-Umfang: addModifier (immediate) + onHit/onKill (getriggert an Hook-Punkten
// des CombatSystem). Phaser-entkoppelt, testbar.

import type { Effect } from '@/types/content';
import type { ModifierOp, ModifierScope } from '@/core/stats/StatTypes';
import { StatKey, STAT_CAPS } from '@/core/stats/StatTypes';
import type { StatEngine } from '@/core/stats/StatEngine';
import type { Rng } from '@/core/rng/Rng';

/** Aggregiertes Ergebnis getriggerter Effekte (onHit/onKill). */
export interface EffectOutcome {
  bonusBalls: number;
  heal: number;
}

export interface HitContext {
  rng: Rng;
  damage: number;
}

export interface KillContext {
  rng: Rng;
}

function emptyOutcome(): EffectOutcome {
  return { bonusBalls: 0, heal: 0 };
}

export class EffectSystem {
  /** Wendet alle addModifier-Effekte auf eine StatEngine an. */
  applyModifiers(
    effects: Effect[] | undefined,
    engine: StatEngine,
    scope: ModifierScope,
    sourceId: string,
  ): void {
    if (!effects) return;
    for (const e of effects) {
      if (e.type !== 'addModifier') continue;
      const stat = e.params.stat as StatKey;
      const op = (e.params.op as ModifierOp) ?? 'flat';
      const value = Number(e.params.value ?? 0);
      if (!Object.values(StatKey).includes(stat)) continue; // unbekannter Stat → ignorieren
      engine.addModifier({ stat, op, value, scope, sourceId });
    }
  }

  /** Triggert onHit-Effekte; summiert Heilung/Bonus-Bälle. */
  triggerOnHit(effects: Effect[] | undefined, ctx: HitContext): EffectOutcome {
    const out = emptyOutcome();
    if (!effects) return out;
    for (const e of effects) {
      if (e.type !== 'onHit') continue;
      const kind = e.params.kind;
      if (kind === 'lifesteal') {
        // Lifesteal-Cap (ADR-010) auch für onHit-Effekte erzwingen.
        const pct = Math.min(Number(e.params.pct ?? 0), STAT_CAPS[StatKey.LifestealPct] ?? 1);
        out.heal += ctx.damage * pct;
      } else if (kind === 'bonusBall') {
        if (ctx.rng.next() < Number(e.params.chance ?? 0)) out.bonusBalls += 1;
      }
    }
    return out;
  }

  /** Triggert onKill-Effekte; summiert Bonus-Bälle. */
  triggerOnKill(effects: Effect[] | undefined, ctx: KillContext): EffectOutcome {
    const out = emptyOutcome();
    if (!effects) return out;
    for (const e of effects) {
      if (e.type !== 'onKill') continue;
      if (e.params.kind === 'bonusBall') {
        const amount = Number(e.params.amount ?? 1);
        const chance = Number(e.params.chance ?? 1);
        if (ctx.rng.next() < chance) out.bonusBalls += amount;
      }
    }
    return out;
  }
}
