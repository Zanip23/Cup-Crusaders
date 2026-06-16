import { describe, it, expect } from 'vitest';
import { StatKey } from '@/core/stats/StatTypes';
import { createInitialState, reducer } from '@/core/state/reducers';
import type { GameState } from '@/types/state';
import type { Action } from '@/core/state/actions';
import {
  createItemInstance,
  itemModifiers,
  levelMultiplier,
  levelUpCost,
  nextRarity,
} from '@/systems/meta/items';
import { canMerge, findMergeGroups } from '@/systems/meta/merge';
import { metaSkillModifiers } from '@/content/metaSkills';
import { buildHeroStats } from '@/systems/combat/heroBuild';

const run = (s: GameState, actions: Action[]) => actions.reduce(reducer, s);

describe('Item-System (docs/07)', () => {
  it('itemModifiers skaliert mit Rarität und Level', () => {
    const common = itemModifiers(createItemInstance('recurve_bow', 'common', 1));
    expect(common[0].stat).toBe(StatKey.AttackDamage);
    expect(common[0].value).toBe(8); // base 8 × 1.0 × 1.0

    const epic = itemModifiers(createItemInstance('recurve_bow', 'epic', 1));
    expect(epic[0].value).toBeCloseTo(12.8); // 8 × 1.6
  });

  it('levelMultiplier: +15 % je Stufe', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(3)).toBeCloseTo(1.3);
  });

  it('nextRarity-Kette endet bei Mythic', () => {
    expect(nextRarity('common')).toBe('rare');
    expect(nextRarity('legendary')).toBe('mythic');
    expect(nextRarity('mythic')).toBeNull();
  });
});

describe('Merge (docs/07)', () => {
  it('canMerge nur bei 3 gleichen, nicht-mythic', () => {
    const a = createItemInstance('recurve_bow', 'common', 1);
    const b = createItemInstance('recurve_bow', 'common', 1);
    const c = createItemInstance('recurve_bow', 'common', 1);
    expect(canMerge([a, b, c])).toBe(true);
    expect(canMerge([a, b])).toBe(false);
    expect(canMerge([a, b, createItemInstance('recurve_bow', 'rare', 1)])).toBe(false);
  });

  it('findMergeGroups gruppiert ≥3 gleiche (ohne ausgerüstete)', () => {
    const inv = [
      createItemInstance('recurve_bow', 'common', 1),
      createItemInstance('recurve_bow', 'common', 1),
      createItemInstance('recurve_bow', 'common', 1),
      createItemInstance('leather_cap', 'common', 1),
    ];
    const groups = findMergeGroups(inv, new Set());
    expect(groups).toHaveLength(1);
    expect(groups[0].instanceIds).toHaveLength(3);
  });
});

describe('Meta-Skills', () => {
  it('metaSkillModifiers summiert je Stufe', () => {
    const mods = metaSkillModifiers({ might: 2 });
    expect(mods[0].stat).toBe(StatKey.AttackDamage);
    expect(mods[0].value).toBe(6); // 3 × 2
    expect(mods[0].scope).toBe('meta');
  });
});

describe('Meta-Reducer', () => {
  it('EQUIP_ITEM legt Item in den richtigen Slot; wirkt in buildHeroStats', () => {
    const bow = createItemInstance('recurve_bow', 'epic', 1);
    let s = createInitialState();
    s = run(s, [
      { type: 'GRANT_ITEM', item: bow },
      { type: 'EQUIP_ITEM', instanceId: bow.instanceId },
    ]);
    expect(s.meta.equipped.weapon).toBe(bow.instanceId);
    const eng = buildHeroStats(s.run, s.meta);
    // Basis 18 + Bogen 12.8 ≈ 30.8
    expect(eng.get(StatKey.AttackDamage)).toBeCloseTo(30.8);
  });

  it('MERGE_ITEMS macht aus 3 commons ein rare', () => {
    let s = createInitialState();
    const items = [0, 1, 2].map(() => createItemInstance('recurve_bow', 'common', 1));
    s = run(s, items.map((item) => ({ type: 'GRANT_ITEM', item }) as Action));
    s = reducer(s, { type: 'MERGE_ITEMS', instanceIds: items.map((i) => i.instanceId) });
    expect(s.meta.inventory).toHaveLength(1);
    expect(s.meta.inventory[0].rarity).toBe('rare');
    expect(s.meta.inventory[0].baseId).toBe('recurve_bow');
  });

  it('LEVEL_ITEM hebt Level gegen Gold an; No-op ohne Gold', () => {
    const bow = createItemInstance('recurve_bow', 'common', 1);
    let s = createInitialState();
    s = reducer(s, { type: 'GRANT_ITEM', item: bow });

    const noGold = reducer(s, { type: 'LEVEL_ITEM', instanceId: bow.instanceId });
    expect(noGold.meta.inventory[0].level).toBe(1); // unbezahlbar → unverändert

    s = { ...s, meta: { ...s.meta, currencies: { gold: 999, blueprints: 0 } } };
    const cost = levelUpCost(1);
    s = reducer(s, { type: 'LEVEL_ITEM', instanceId: bow.instanceId });
    expect(s.meta.inventory[0].level).toBe(2);
    expect(s.meta.currencies.gold).toBe(999 - cost.gold);
  });

  it('BUY_META_SKILL erhöht die Stufe und zieht Gold ab', () => {
    let s = createInitialState();
    s = { ...s, meta: { ...s.meta, currencies: { gold: 1000, blueprints: 0 } } };
    s = reducer(s, { type: 'BUY_META_SKILL', skillId: 'might' });
    expect(s.meta.metaSkills.might).toBe(1);
    expect(s.meta.currencies.gold).toBeLessThan(1000);
  });

  it('END_RUN(victory) zahlt Gold aus und kehrt ins Menü zurück', () => {
    let s = reducer(createInitialState(), {
      type: 'START_RUN',
      levelId: 'world_1',
      totalWaves: 15,
      seed: 1,
      maxHp: 120,
    });
    s = reducer(s, { type: 'END_RUN', victory: true });
    expect(s.run.phase).toBe('menu');
    expect(s.meta.currencies.gold).toBeGreaterThan(0);
  });
});
