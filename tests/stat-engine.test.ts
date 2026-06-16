import { describe, it, expect } from 'vitest';
import { StatEngine } from '@/core/stats/StatEngine';
import { StatKey } from '@/core/stats/StatTypes';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { Rng } from '@/core/rng/Rng';

describe('StatEngine — Berechnungsreihenfolge & Caps (docs/08)', () => {
  it('final = (base + Σflat) × (1 + ΣpercentAdd) × Π percentMult', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.AttackDamage]: 10 });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'flat', value: 5, scope: 'run', sourceId: 'a' });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'percentAdd', value: 0.1, scope: 'run', sourceId: 'b' });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'percentAdd', value: 0.1, scope: 'run', sourceId: 'c' });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'percentMult', value: 1.1, scope: 'run', sourceId: 'd' });
    // (10+5) × (1+0.2) × 1.1 = 19.8
    expect(e.get(StatKey.AttackDamage)).toBeCloseTo(19.8, 5);
  });

  it('erzwingt Caps (Dodge ≤ 0.35)', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.Dodge]: 0.3 });
    e.addModifier({ stat: StatKey.Dodge, op: 'flat', value: 0.5, scope: 'run', sourceId: 'x' });
    expect(e.get(StatKey.Dodge)).toBe(0.35);
  });

  it('clearScope entfernt nur den angegebenen Scope', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.MaxHp]: 100 });
    e.addModifier({ stat: StatKey.MaxHp, op: 'flat', value: 50, scope: 'run', sourceId: 'run1' });
    e.addModifier({ stat: StatKey.MaxHp, op: 'flat', value: 20, scope: 'meta', sourceId: 'meta1' });
    expect(e.get(StatKey.MaxHp)).toBe(170);
    e.clearScope('run');
    expect(e.get(StatKey.MaxHp)).toBe(120); // meta bleibt
  });

  it('removeBySource entfernt gezielt', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.Armor]: 0 });
    e.addModifier({ stat: StatKey.Armor, op: 'flat', value: 30, scope: 'run', sourceId: 'item:plate' });
    expect(e.get(StatKey.Armor)).toBe(30);
    e.removeBySource('item:plate');
    expect(e.get(StatKey.Armor)).toBe(0);
  });

  it('klammert nie unter 0 (große negative Modifier)', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.AttackDamage]: 10 });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'percentAdd', value: -2, scope: 'run', sourceId: 'x' });
    expect(e.get(StatKey.AttackDamage)).toBe(0); // 10×(1−2) = −10 → 0
  });

  it('pruneExpired entfernt abgelaufene buffs', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.AttackDamage]: 10 });
    e.addModifier({ stat: StatKey.AttackDamage, op: 'flat', value: 5, scope: 'buff', sourceId: 'b', expiresAt: 100 });
    expect(e.get(StatKey.AttackDamage)).toBe(15);
    e.pruneExpired(150);
    expect(e.get(StatKey.AttackDamage)).toBe(10);
  });
});

describe('EffectSystem — addModifier / onHit / onKill (docs/08 §2)', () => {
  it('applyModifiers fügt Modifier zur StatEngine hinzu', () => {
    const e = new StatEngine();
    e.setBase({ [StatKey.MaxHp]: 100 });
    new EffectSystem().applyModifiers(
      [{ type: 'addModifier', params: { stat: StatKey.MaxHp, op: 'percentAdd', value: 0.25 } }],
      e,
      'run',
      'upgrade:vitalstrom',
    );
    expect(e.get(StatKey.MaxHp)).toBe(125);
  });

  it('triggerOnHit: Lifesteal heilt anteilig am Schaden', () => {
    const out = new EffectSystem().triggerOnHit(
      [{ type: 'onHit', params: { kind: 'lifesteal', pct: 0.1 } }],
      { rng: new Rng(1), damage: 50 },
    );
    expect(out.heal).toBeCloseTo(5);
  });

  it('triggerOnHit: Lifesteal-Effekt respektiert das Cap (ADR-010)', () => {
    const out = new EffectSystem().triggerOnHit(
      [{ type: 'onHit', params: { kind: 'lifesteal', pct: 0.9 } }],
      { rng: new Rng(1), damage: 100 },
    );
    expect(out.heal).toBeCloseTo(20); // 100 × min(0.9, 0.2)
  });

  it('triggerOnKill: bonusBall mit amount', () => {
    const out = new EffectSystem().triggerOnKill(
      [{ type: 'onKill', params: { kind: 'bonusBall', amount: 2 } }],
      { rng: new Rng(1) },
    );
    expect(out.bonusBalls).toBe(2);
  });
});
