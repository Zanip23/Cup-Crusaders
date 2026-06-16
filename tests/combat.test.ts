import { describe, it, expect } from 'vitest';
import { StatEngine } from '@/core/stats/StatEngine';
import { StatKey } from '@/core/stats/StatTypes';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { Rng } from '@/core/rng/Rng';
import { CombatSystem } from '@/systems/combat/CombatSystem';
import type { EnemyInstance } from '@/systems/combat/types';
import { scaleEnemy, DEFAULT_SCALING } from '@/content/scaling';
import { rewardFraction, runRewardGold } from '@/systems/combat/rewards';
import { buildWave } from '@/systems/WaveSpawner';
import { WORLD_1 } from '@/content/waves/world-1';
import { BRIGAND_LORD, MUG_GREMLIN } from '@/content/enemies';

function deterministicHero(overrides: Partial<Record<StatKey, number>> = {}): StatEngine {
  const e = new StatEngine();
  e.setBase({
    [StatKey.MaxHp]: 100,
    [StatKey.AttackDamage]: 12,
    [StatKey.ProjectileCount]: 1,
    [StatKey.CritChance]: 0,
    [StatKey.CritMultiplier]: 2,
    [StatKey.LifestealPct]: 0,
    [StatKey.BallDropOnHitChance]: 0,
    [StatKey.ExtraAttack]: 0,
    [StatKey.Armor]: 0,
    [StatKey.Dodge]: 0,
    ...overrides,
  });
  return e;
}

function enemy(hp: number, dmg: number, ballDrop: number, id = 'e1'): EnemyInstance {
  return {
    instanceId: id,
    defId: 'test',
    name: 'Test',
    role: 'normal',
    maxHp: hp,
    hp,
    contactDamage: dmg,
    ballDrop,
    alive: true,
  };
}

describe('CombatSystem — rundenbasiertes Auto-Battle', () => {
  it('Held-Zug tötet Gegner und droppt garantierte Tod-Bälle', () => {
    const cs = new CombatSystem(deterministicHero(), [enemy(12, 10, 3)], new Rng(1), new EffectSystem(), 100);
    const r = cs.heroTurn();
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].damage).toBe(12);
    expect(r.hits[0].killed).toBe(true);
    expect(r.hits[0].ballsDropped).toBe(3); // ballDrop bei Tod
    expect(cs.isWaveCleared()).toBe(true);
  });

  it('ProjectileCount erzeugt mehrere Angriffe pro Zug', () => {
    const hero = deterministicHero({ [StatKey.ProjectileCount]: 3 });
    const cs = new CombatSystem(hero, [enemy(1000, 0, 0)], new Rng(1), new EffectSystem(), 100);
    const r = cs.heroTurn();
    expect(r.hits).toHaveLength(3);
  });

  it('Crit (Cap 0.6) verdoppelt den Schaden bei Treffer', () => {
    // CritChance ist bei 0.6 gecappt (ADR-010) → über viele Angriffe Mischung.
    const hero = deterministicHero({
      [StatKey.CritChance]: 0.6,
      [StatKey.CritMultiplier]: 2,
      [StatKey.ProjectileCount]: 12,
    });
    const cs = new CombatSystem(hero, [enemy(100000, 0, 0)], new Rng(1), new EffectSystem(), 100);
    const r = cs.heroTurn();
    expect(r.hits.some((h) => h.crit && h.damage === 24)).toBe(true);
    expect(r.hits.some((h) => !h.crit && h.damage === 12)).toBe(true);
  });

  it('Lifesteal heilt den Helden (gecappt)', () => {
    const hero = deterministicHero({ [StatKey.LifestealPct]: 0.5 });
    const cs = new CombatSystem(hero, [enemy(1000, 0, 0)], new Rng(1), new EffectSystem(), 50);
    const r = cs.heroTurn();
    // Lifesteal-Cap 0.2 → heal = 12 × 0.2 = 2.4 → gerundet 2
    expect(r.healed).toBe(2);
  });

  it('Gegner-Zug fügt Schaden zu; Armor reduziert ihn', () => {
    const hero = deterministicHero({ [StatKey.Armor]: 100 }); // DR = 100/200 = 50 %
    const cs = new CombatSystem(hero, [enemy(1000, 20, 0)], new Rng(1), new EffectSystem(), 100);
    const r = cs.enemyTurn();
    expect(r.attacks[0].dealt).toBe(10);
    expect(cs.getHeroHp()).toBe(90);
  });

  it('Pierce lässt ein Projektil zusätzliche Ziele treffen', () => {
    const hero = deterministicHero({ [StatKey.Pierce]: 1, [StatKey.ProjectileCount]: 1 });
    const cs = new CombatSystem(
      hero,
      [enemy(1000, 0, 0, 'a'), enemy(1000, 0, 0, 'b')],
      new Rng(1),
      new EffectSystem(),
      100,
    );
    const r = cs.heroTurn();
    expect(r.hits).toHaveLength(2); // 1 Projektil → 2 Gegner
    expect(new Set(r.hits.map((h) => h.targetId)).size).toBe(2);
  });

  it('Ricochet lässt ein Projektil abprallen (zusätzliches Ziel)', () => {
    const hero = deterministicHero({ [StatKey.RicochetBounces]: 1, [StatKey.ProjectileCount]: 1 });
    const cs = new CombatSystem(
      hero,
      [enemy(1000, 0, 0, 'a'), enemy(1000, 0, 0, 'b')],
      new Rng(1),
      new EffectSystem(),
      100,
    );
    expect(cs.heroTurn().hits).toHaveLength(2);
  });

  it('AttackSpeed erzeugt Zusatzangriffe (docs/04)', () => {
    const hero = deterministicHero({ [StatKey.AttackSpeed]: 1, [StatKey.ProjectileCount]: 1 });
    const cs = new CombatSystem(hero, [enemy(100000, 0, 0)], new Rng(1), new EffectSystem(), 100);
    expect(cs.heroTurn().hits).toHaveLength(2); // 1 + 1 AttackSpeed
  });

  it('Held stirbt, wenn HP auf 0 fällt', () => {
    const cs = new CombatSystem(deterministicHero(), [enemy(1000, 60, 0)], new Rng(1), new EffectSystem(), 50);
    cs.enemyTurn();
    expect(cs.isHeroDead()).toBe(true);
    expect(cs.getHeroHp()).toBe(0);
  });
});

describe('Skalierung & WaveSpawner', () => {
  it('Boss-Skalierung multipliziert HP ×10 (Welle/Kapitel 1)', () => {
    const s = scaleEnemy(BRIGAND_LORD, 1, 1, DEFAULT_SCALING);
    expect(s.hp).toBe(BRIGAND_LORD.baseStats.hp * 10);
  });

  it('Boss erhält KEINE zusätzliche Wellen-Skalierung (Set-Piece)', () => {
    // Welle 15 darf den Boss NICHT zusätzlich ×1.98 aufblähen.
    const w15 = scaleEnemy(BRIGAND_LORD, 15, 1, DEFAULT_SCALING);
    expect(w15.hp).toBe(BRIGAND_LORD.baseStats.hp * 10); // == Welle 1
  });

  it('Wellen-Skalierung erhöht HP linear (+7 %/Welle)', () => {
    const w1 = scaleEnemy(MUG_GREMLIN, 1, 1).hp;
    const w11 = scaleEnemy(MUG_GREMLIN, 11, 1).hp;
    expect(w11).toBe(Math.round(MUG_GREMLIN.baseStats.hp * (1 + 0.07 * 10)));
    expect(w11).toBeGreaterThan(w1);
  });

  it('buildWave: Welt 1 hat 15 Wellen, letzte ist Boss', () => {
    expect(WORLD_1.waves).toHaveLength(15);
    const boss = buildWave(WORLD_1, 15);
    expect(boss).toHaveLength(1);
    expect(boss[0].role).toBe('boss');
    const normal = buildWave(WORLD_1, 1);
    expect(normal.length).toBeGreaterThan(0);
    expect(normal[0].role).toBe('normal');
  });
});

describe('Wellen-Reward-Kurve (ADR-007)', () => {
  it('Anteil steigt mit erreichter Welle; Boss = 85 %', () => {
    expect(rewardFraction(1)).toBe(0.35);
    expect(rewardFraction(5)).toBe(0.55);
    expect(rewardFraction(10)).toBe(0.7);
    expect(rewardFraction(15, true)).toBe(0.85);
  });

  it('runRewardGold zahlt auch bei früher Niederlage etwas aus', () => {
    expect(runRewardGold(1)).toBeGreaterThan(0);
    expect(runRewardGold(10)).toBeGreaterThan(runRewardGold(1));
  });
});
