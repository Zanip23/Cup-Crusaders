import { describe, it, expect } from 'vitest';
import { Rng } from '@/core/rng/Rng';
import { StatKey } from '@/core/stats/StatTypes';
import { UPGRADES, UPGRADE_REGISTRY } from '@/content/upgrades';
import { availableUpgrades, drawCards, scaledCost, weightOf } from '@/systems/shop/ShopPool';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { FLETCHER } from '@/content/heroes/fletcher';

describe('ShopPool — Pool, Gewichtung, Kosten (docs/06, docs/10)', () => {
  it('drawCards zieht 3 verschiedene Karten, seed-deterministisch', () => {
    const a = drawCards(UPGRADES, new Rng(123), 3);
    const b = drawCards(UPGRADES, new Rng(123), 3);
    expect(a).toHaveLength(3);
    expect(a.map((u) => u.id)).toEqual(b.map((u) => u.id)); // reproduzierbar
    expect(new Set(a.map((u) => u.id)).size).toBe(3); // ohne Zurücklegen
  });

  it('availableUpgrades filtert maxStacks-erschöpfte Upgrades aus', () => {
    // sharpshooter hat maxStacks 4 → 4× gekauft ⇒ nicht mehr verfügbar.
    const purchased = ['sharpshooter', 'sharpshooter', 'sharpshooter', 'sharpshooter'];
    const avail = availableUpgrades(UPGRADES, purchased);
    expect(avail.find((u) => u.id === 'sharpshooter')).toBeUndefined();
    expect(avail.find((u) => u.id === 'multishot')).toBeDefined();
  });

  it('scaledCost steigt mit der Welle (costScalingPerWave)', () => {
    const u = UPGRADE_REGISTRY['multishot'];
    expect(scaledCost(u, 1)).toBe(u.cost);
    expect(scaledCost(u, 6)).toBeGreaterThan(u.cost);
  });

  it('weightOf: seltenere Raritäten haben kleineres Gewicht', () => {
    const common = UPGRADE_REGISTRY['sharpshooter'];
    const epic = UPGRADE_REGISTRY['multishot'];
    expect(weightOf(common)).toBeGreaterThan(weightOf(epic));
  });

  it('jede Kategorie ist im Pool vertreten (Roadmap M4)', () => {
    const cats = new Set(UPGRADES.map((u) => u.category));
    expect(cats).toEqual(new Set(['combat', 'pachinko', 'passive']));
  });
});

describe('buildHeroStats — Upgrades wirken über die StatEngine (docs/06)', () => {
  it('ohne Upgrades = Basis-Stats des Helden', () => {
    const e = buildHeroStats([]);
    expect(e.get(StatKey.AttackDamage)).toBe(FLETCHER.baseStats[StatKey.AttackDamage]);
  });

  it('multishot erhöht ProjectileCount; vital_surge die MaxHp', () => {
    const e = buildHeroStats(['multishot', 'vital_surge']);
    expect(e.get(StatKey.ProjectileCount)).toBe(2); // base 1 + 1
    expect(e.get(StatKey.MaxHp)).toBe(150); // 120 × 1.25
  });

  it('wiederholte IDs stacken (multishot ×2 → ProjectileCount 3)', () => {
    const e = buildHeroStats(['multishot', 'multishot']);
    expect(e.get(StatKey.ProjectileCount)).toBe(3);
  });

  it('extra_ammo erhöht StartingBalls für den Drop', () => {
    const e = buildHeroStats(['extra_ammo', 'extra_ammo']);
    expect(e.get(StatKey.StartingBalls)).toBe(10);
  });
});

describe('Upgrade-Content-Integrität', () => {
  it('eindeutige IDs, Kosten ≥ 0, bekannte Effekt-Stats', () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UPGRADES) {
      expect(u.cost).toBeGreaterThanOrEqual(0);
      for (const eff of u.effects) {
        if (eff.type === 'addModifier') {
          expect(Object.values(StatKey)).toContain(eff.params.stat);
        }
      }
    }
  });
});
