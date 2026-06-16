// Baut die Helden-StatEngine aus allen Modifier-Quellen mit ihrem Scope (docs/07):
//   final = Basis + Σ Meta-Modifier (Items, Meta-Skills) + Σ Run-Modifier (Upgrades)
// So wirken sowohl permanente Ausrüstung als auch Run-Upgrades über EINE Wahrheit.

import { StatEngine } from '@/core/stats/StatEngine';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { FLETCHER } from '@/content/heroes/fletcher';
import { UPGRADE_REGISTRY } from '@/content/upgrades';
import { itemModifiers } from '@/systems/meta/items';
import { metaSkillModifiers } from '@/content/metaSkills';
import type { MetaState, RunState } from '@/types/state';

export function buildHeroStats(run: RunState, meta: MetaState): StatEngine {
  const engine = new StatEngine();
  engine.setBase(FLETCHER.baseStats);

  // Meta (permanent): ausgerüstete Items.
  const byId = new Map(meta.inventory.map((i) => [i.instanceId, i]));
  for (const instanceId of Object.values(meta.equipped)) {
    if (!instanceId) continue;
    const inst = byId.get(instanceId);
    if (inst) for (const mod of itemModifiers(inst)) engine.addModifier(mod);
  }
  // Meta (permanent): Skill-Stufen.
  for (const mod of metaSkillModifiers(meta.metaSkills)) engine.addModifier(mod);

  // Run (temporär): gekaufte Shop-Upgrades (wiederholte IDs = Stacks).
  const effects = new EffectSystem();
  for (const id of run.upgrades) {
    const def = UPGRADE_REGISTRY[id];
    if (def) effects.applyModifiers(def.effects, engine, 'run', `upgrade:${id}`);
  }
  return engine;
}
