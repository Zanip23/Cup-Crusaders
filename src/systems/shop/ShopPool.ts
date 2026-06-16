// Shop-Kartenziehung: gewichteter Pool, Verfügbarkeitsfilter, Kosten-Skalierung
// (docs/06, docs/10). Seedbar/rein → testbar.

import type { Rng } from '@/core/rng/Rng';
import type { Rarity } from '@/types/content';
import type { UpgradeDef } from '@/content/upgrades';

const DEFAULT_WEIGHT: Record<Rarity, number> = {
  common: 100,
  rare: 50,
  epic: 20,
  legendary: 8,
  mythic: 3,
};

/** Pro Welle leicht steigende Kosten, damit Bälle ihren Wert behalten (docs/06). */
export const COST_SCALING_PER_WAVE = 0.08;

export function weightOf(u: UpgradeDef): number {
  return u.weight ?? DEFAULT_WEIGHT[u.rarity];
}

export function scaledCost(u: UpgradeDef, wave: number): number {
  return Math.round(u.cost * (1 + COST_SCALING_PER_WAVE * (wave - 1)));
}

function counts(ids: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id of ids) c[id] = (c[id] ?? 0) + 1;
  return c;
}

/** Upgrades, die noch ziehbar sind (maxStacks/requires/excludes berücksichtigt). */
export function availableUpgrades(all: UpgradeDef[], purchased: string[]): UpgradeDef[] {
  const c = counts(purchased);
  return all.filter((u) => {
    if (u.maxStacks !== undefined && (c[u.id] ?? 0) >= u.maxStacks) return false;
    if (u.requires && !u.requires.every((r) => (c[r] ?? 0) > 0)) return false;
    if (u.excludes && u.excludes.some((x) => (c[x] ?? 0) > 0)) return false;
    return true;
  });
}

/** Zieht bis zu n Karten gewichtet OHNE Zurücklegen (seedbar). */
export function drawCards(pool: UpgradeDef[], rng: Rng, n = 3): UpgradeDef[] {
  const remaining = [...pool];
  const out: UpgradeDef[] = [];
  while (out.length < n && remaining.length > 0) {
    const pick = rng.weightedPick(remaining, weightOf);
    out.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return out;
}
