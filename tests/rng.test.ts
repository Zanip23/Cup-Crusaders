import { describe, it, expect } from 'vitest';
import { Rng } from '@/core/rng/Rng';

describe('Rng — seedbar & deterministisch', () => {
  it('gleicher Seed → gleiche Sequenz', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('unterschiedliche Seeds → unterschiedliche Sequenzen', () => {
    const a = new Rng(1).next();
    const b = new Rng(2).next();
    expect(a).not.toBe(b);
  });

  it('next() liegt in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('intBetween hält die Grenzen ein (inklusive)', () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.intBetween(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('weightedPick bevorzugt höheres Gewicht', () => {
    const r = new Rng(123);
    const items = [
      { id: 'rare', w: 1 },
      { id: 'common', w: 99 },
    ];
    let common = 0;
    for (let i = 0; i < 1000; i++) {
      if (r.weightedPick(items, (it) => it.w).id === 'common') common++;
    }
    expect(common).toBeGreaterThan(900);
  });

  it('Seed 0 wird auf einen brauchbaren Wert normalisiert (kein Stuck-at-0)', () => {
    const r = new Rng(0);
    const vals = new Set(Array.from({ length: 5 }, () => r.next()));
    expect(vals.size).toBeGreaterThan(1);
  });
});
