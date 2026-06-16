import { describe, it, expect } from 'vitest';
import { applyGateEffect, binContribution, DropResolver } from '@/systems/drop/DropResolver';
import { BOARD_BASIC } from '@/content/boards/basic';

describe('DropResolver — Value-Carrying & Summation (ADR-009)', () => {
  it('gateMultiply multipliziert, gateAdd addiert', () => {
    expect(applyGateEffect(1, { type: 'gateMultiply', params: { factor: 2 } })).toBe(2);
    expect(applyGateEffect(3, { type: 'gateAdd', params: { amount: 5 } })).toBe(8);
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

describe('BOARD_BASIC — Near-Miss-Layout', () => {
  it('hat zentralen x10-Bin und je 2 Tore/Pegs', () => {
    expect(BOARD_BASIC.bins.map((b) => b.multiplier)).toEqual([1, 5, 10, 5, 1]);
    expect(BOARD_BASIC.bins[2].multiplier).toBe(10); // zentral
    expect(BOARD_BASIC.gates).toHaveLength(2);
    expect(BOARD_BASIC.pegs.length).toBeGreaterThan(20);
  });
});
