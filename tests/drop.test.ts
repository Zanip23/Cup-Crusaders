import { describe, it, expect } from 'vitest';
import {
  applyBarValue,
  applyGateEffect,
  binContribution,
  DropResolver,
} from '@/systems/drop/DropResolver';
import { BOARD_BASIC } from '@/content/boards/basic';

describe('DropResolver — Value-Carrying & Summation (ADR-009)', () => {
  it('gateMultiply multipliziert, gateAdd addiert', () => {
    expect(applyGateEffect(1, { type: 'gateMultiply', params: { factor: 2 } })).toBe(2);
    expect(applyGateEffect(3, { type: 'gateAdd', params: { amount: 5 } })).toBe(8);
  });

  it('applyBarValue: multiply/add/subtract — subtract bei 0 gekappt', () => {
    expect(applyBarValue(2, 'multiply', 3)).toBe(6);
    expect(applyBarValue(2, 'add', 3)).toBe(5);
    expect(applyBarValue(5, 'subtract', 2)).toBe(3);
    expect(applyBarValue(1, 'subtract', 4)).toBe(0); // nie negativ
    expect(applyBarValue(7, 'bounce', 12)).toBe(7); // wertneutral
    expect(applyBarValue(7, 'breakable')).toBe(7); // wertneutral
  });

  it('binContribution = value × multiplier', () => {
    expect(binContribution(2, 10)).toBe(20);
    expect(binContribution(1, 5)).toBe(5);
  });

  it('summiert Beiträge mehrerer Bälle korrekt', () => {
    const r = new DropResolver();
    r.collect(1, 10); // 10
    r.collect(2, 5); //  10  (value 2 nach x2-Tor, dann x5-Bin)
    r.collect(1, 1); //   1
    expect(r.total()).toBe(21);
    expect(r.resolvedCount()).toBe(3);
  });

  it('despawnte Bälle zählen als resolved (Phase endet garantiert)', () => {
    const r = new DropResolver();
    r.collect(1, 5);
    r.collectLost(0);
    expect(r.resolvedCount()).toBe(2);
    expect(r.total()).toBe(5);
  });

  it('Kette x2-Tor → x10-Bin ergibt 20', () => {
    const r = new DropResolver();
    let v = 1;
    v = applyGateEffect(v, { type: 'gateMultiply', params: { factor: 2 } });
    r.collect(v, 10);
    expect(r.total()).toBe(20);
  });
});

describe('BOARD_BASIC — Near-Miss-Layout + Balken', () => {
  it('hat zentralen x10-Bin', () => {
    expect(BOARD_BASIC.bins.map((b) => b.multiplier)).toEqual([1, 5, 10, 5, 1]);
    expect(BOARD_BASIC.bins[2].multiplier).toBe(10); // zentral
  });

  it('bietet alle Balken-Wirkungen (multiply/bounce/subtract/add/breakable)', () => {
    const kinds = new Set(BOARD_BASIC.bars.map((b) => b.kind));
    expect(kinds.has('multiply')).toBe(true);
    expect(kinds.has('bounce')).toBe(true);
    expect(kinds.has('subtract')).toBe(true);
    expect(kinds.has('add')).toBe(true);
    expect(kinds.has('breakable')).toBe(true);
  });

  it('zerstörbare Balken brauchen mehrere Treffer (hp > 1)', () => {
    const breakables = BOARD_BASIC.bars.filter((b) => b.kind === 'breakable');
    expect(breakables.length).toBeGreaterThan(0);
    expect(breakables.every((b) => (b.hp ?? 0) > 1)).toBe(true);
  });
});
