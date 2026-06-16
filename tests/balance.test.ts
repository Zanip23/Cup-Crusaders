import { describe, it, expect } from 'vitest';
import { Rng } from '@/core/rng/Rng';
import { StatKey } from '@/core/stats/StatTypes';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { CombatSystem } from '@/systems/combat/CombatSystem';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { buildWave } from '@/systems/WaveSpawner';
import { WORLD_1 } from '@/content/waves/world-1';
import { FLETCHER } from '@/content/heroes/fletcher';
import { createInitialState } from '@/core/state/reducers';

// Pure Kampf-Simulation als Balancing-Leitplanke (kein Echtzeit/Physik).
// Held startet voll geheilt (MVP-Recovery je Welle).
function simulate(upgrades: string[], wave: number, seed = 7): {
  won: boolean;
  rounds: number;
  balls: number;
  hpLeft: number;
} {
  const base = createInitialState();
  const hero = buildHeroStats({ ...base.run, upgrades }, base.meta);
  const enemies = buildWave(WORLD_1, wave);
  const cs = new CombatSystem(
    hero,
    enemies,
    new Rng(seed),
    new EffectSystem(),
    hero.get(StatKey.MaxHp),
    FLETCHER.signature?.effects ?? [],
  );
  let rounds = 0;
  let balls = 0;
  while (!cs.isWaveCleared() && !cs.isHeroDead() && rounds < 1000) {
    balls += cs.heroTurn().ballsCollected;
    if (cs.isWaveCleared()) break;
    cs.enemyTurn();
    rounds++;
  }
  return { won: cs.isWaveCleared(), rounds, balls, hpLeft: cs.getHeroHp() };
}

const STRONG_BUILD = [
  'multishot', 'multishot', 'multishot', // ProjectileCount +3
  'power_throw', 'power_throw', 'power_throw', 'power_throw', 'power_throw', // +75 % dmg
  'iron_skin', 'iron_skin', 'iron_skin', // +60 Armor
  'vital_surge', 'vital_surge', 'vital_surge', 'vital_surge', // +100 % HP
  'bloodfletch', 'bloodfletch', 'bloodfletch', // Lifesteal
];

describe('Balancing-Leitplanken (empirisch, docs/10)', () => {
  it('Basis-Held räumt frühe Wellen klar und zügig', () => {
    const r = simulate([], 1);
    expect(r.won).toBe(true);
    expect(r.rounds).toBeLessThan(30);
    expect(r.hpLeft).toBeGreaterThan(0);
  });

  it('Boss ist ohne Build eine echte Hürde (Basis-Held verliert)', () => {
    const r = simulate([], 15);
    expect(r.won).toBe(false); // Build-Check, keine Statistikmauer
  });

  it('Boss ist mit starkem Build besiegbar (in vertretbarer Zeit)', () => {
    const r = simulate(STRONG_BUILD, 15);
    expect(r.won).toBe(true);
    expect(r.rounds).toBeLessThan(60);
  });

  it('Kampf liefert Bälle für die Drop-Phase', () => {
    expect(simulate([], 1).balls).toBeGreaterThan(0);
  });
});
