import type { Effect } from '@/types/content';

export type MysteryEffect =
  | { kind: 'effect'; effect: Effect; label: string; strong?: boolean }
  | { kind: 'loseBall'; label: string; strong?: boolean };

export interface MysteryPoolEntry {
  weight: number;
  result: MysteryEffect;
}

export interface MysteryPool {
  id: string;
  entries: MysteryPoolEntry[];
}

const multiply = (factor: number, weight: number): MysteryPoolEntry => ({
  weight,
  result: {
    kind: 'effect',
    effect: { type: 'gateMultiply', params: { factor } },
    label: `Mystery: x${factor}!`,
    strong: factor >= 3,
  },
});

const add = (amount: number, weight: number): MysteryPoolEntry => ({
  weight,
  result: {
    kind: 'effect',
    effect: { type: 'gateAdd', params: { amount } },
    label: `Mystery: +${amount}!`,
    strong: true,
  },
});

const bonusBalls = (amount: number, weight: number): MysteryPoolEntry => ({
  weight,
  result: {
    kind: 'effect',
    effect: { type: 'gateAdd', params: { amount } },
    label: amount === 1 ? 'Mystery: Bonusball!' : `Mystery: +${amount} Bälle!`,
    strong: amount > 1,
  },
});

const loseBall = (weight: number): MysteryPoolEntry => ({
  weight,
  result: { kind: 'loseBall', label: 'Mystery: Ball weg!', strong: false },
});

export const MYSTERY_POOLS = {
  standard: {
    id: 'standard',
    entries: [
      multiply(2, 34),
      multiply(3, 20),
      multiply(5, 7),
      multiply(8, 2),
      add(5, 18),
      add(10, 7),
      bonusBalls(1, 12),
    ],
  },
  risky: {
    id: 'risky',
    entries: [
      multiply(2, 24),
      multiply(3, 20),
      multiply(5, 12),
      multiply(8, 5),
      add(5, 14),
      add(10, 9),
      bonusBalls(2, 8),
      loseBall(8),
    ],
  },
} as const satisfies Record<string, MysteryPool>;

export type MysteryPoolId = keyof typeof MYSTERY_POOLS;

export function mysteryPoolIdForChallenge(challenge: number): MysteryPoolId {
  return challenge >= 8 ? 'risky' : 'standard';
}

export function createMysteryEffect(poolId: MysteryPoolId = 'standard'): Effect {
  return { type: 'gateMystery', params: { poolId } };
}

export function pickMysteryEffect(
  effect: Effect,
  random: () => number = Math.random,
): MysteryEffect {
  const poolId = String(effect.params.poolId ?? 'standard') as MysteryPoolId;
  const pool = MYSTERY_POOLS[poolId] ?? MYSTERY_POOLS.standard;
  const totalWeight = pool.entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = random() * totalWeight;

  for (const entry of pool.entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.result;
  }

  return pool.entries[pool.entries.length - 1]?.result ?? bonusBalls(1, 1).result;
}
