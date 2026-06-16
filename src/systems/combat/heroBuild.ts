// Baut die Helden-StatEngine aus Basis-Stats + gekauften Run-Upgrades.
// So wirken Shop-Upgrades nachweisbar ab der nächsten Welle (docs/06). Testbar.

import { StatEngine } from '@/core/stats/StatEngine';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { FLETCHER } from '@/content/heroes/fletcher';
import { UPGRADE_REGISTRY } from '@/content/upgrades';

export function buildHeroStats(upgradeIds: string[]): StatEngine {
  const engine = new StatEngine();
  engine.setBase(FLETCHER.baseStats);
  const effects = new EffectSystem();
  // Wiederholte IDs = Stacks → Effekte werden mehrfach angewendet.
  for (const id of upgradeIds) {
    const def = UPGRADE_REGISTRY[id];
    if (def) effects.applyModifiers(def.effects, engine, 'run', `upgrade:${id}`);
  }
  return engine;
}
