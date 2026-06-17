// Drop-Board im „Fill-the-Cup"-Stil (Referenz): ein beweglicher Becher oben
// schüttet Bälle aus, sie fallen durch horizontale MULTIPLIKATOR-BALKEN, die die
// Ball-ANZAHL vervielfachen (gateMultiply spawnt Bonus-Bälle, ohne den Wert zu
// ändern), und ein unten angesetzter TRICHTER leitet alles in den Fang-Becher.
// ADR-009: reine Physik bestimmt das Ergebnis.

import { createMysteryEffect } from '@/content/boards/mysteryPools';
import type { BoardDef, BoardBlockerDef, BoardPlatformDef, Effect } from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

const W = GAME_WIDTH;
const POST = 0xbf7134; // warmes Holzpfosten-Braun

// Farbschema der Balken nach Wirkung (wie Referenz).
const BAR_COLOR = {
  mult: 0xf2a91c, // amber: x2/x3 …
  high: 0x20b457, // grün: hohe Multiplikatoren / Bonus
  mystery: 0x7b4ee6, // lila: ???
  boost: 0x18aeea, // blau: ⌃ Boost
} as const;

function defaultBins() {
  const binW = W / 5;
  return [1, 2, 5, 2, 1].map((multiplier, index) => ({
    x: index * binW,
    w: binW,
    multiplier,
    label: `x${multiplier}`,
  }));
}

function mult(factor: number): Effect {
  return { type: 'gateMultiply', params: { factor } };
}
function mystery(pool: 'standard' | 'risky' = 'standard'): Effect {
  return createMysteryEffect(pool);
}

// Ein Balken-Segment in einer Reihe.
function bar(
  x: number,
  y: number,
  w: number,
  label: string,
  effect: Effect,
  color: number,
): BoardPlatformDef {
  return { x, y, w, h: 44, label: label.toUpperCase(), effect, color };
}

// Kurzer vertikaler Leitpfosten (hängt von einer Balkenreihe herab).
function post(x: number, y: number, h = 96): BoardBlockerDef {
  return { x, y, w: 30, h, color: POST };
}

export const BOARD_BASIC: BoardDef = {
  id: 'board_basic',
  width: W,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.3,
  catcherWidth: 168,
  pegs: [],
  platforms: [
    // Reihe 1: x3 | x4
    bar(W * 0.18, 430, 250, 'x3', mult(3), BAR_COLOR.mult),
    bar(W * 0.68, 430, 330, 'x4', mult(4), BAR_COLOR.high),
    // Reihe 2: ??? | x2
    bar(W * 0.2, 620, 250, '???', mystery('standard'), BAR_COLOR.mystery),
    bar(W * 0.74, 620, 270, 'x2', mult(2), BAR_COLOR.mult),
    // Reihe 3: x2 | (Boost) | x2
    bar(W * 0.16, 820, 200, 'x2', mult(2), BAR_COLOR.mult),
    bar(W * 0.82, 820, 200, 'x2', mult(2), BAR_COLOR.mult),
  ],
  boosters: [
    {
      x: W * 0.5,
      y: 820,
      w: 168,
      h: 34,
      label: 'BOOST',
      effect: mult(2),
      color: BAR_COLOR.boost,
    },
  ],
  blockers: [
    post(W * 0.43, 470, 110),
    post(W * 0.5, 660, 90),
    post(W * 0.62, 660, 90),
    post(W * 0.36, 860, 80),
    post(W * 0.64, 860, 80),
  ],
  gates: [],
  bins: defaultBins(),
  maxConcurrentBalls: 250,
};

export const BOARD_DENSE: BoardDef = {
  id: 'board_dense',
  width: W,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.34,
  catcherWidth: 150,
  pegs: [],
  platforms: [
    // Reihe 1: x3 | x2 | x3
    bar(W * 0.16, 400, 230, 'x3', mult(3), BAR_COLOR.high),
    bar(W * 0.84, 400, 230, 'x3', mult(3), BAR_COLOR.high),
    bar(W * 0.5, 400, 180, 'x2', mult(2), BAR_COLOR.mult),
    // Reihe 2: x4 | x3
    bar(W * 0.42, 600, 430, 'x4', mult(4), BAR_COLOR.high),
    bar(W * 0.89, 600, 150, 'x3', mult(3), BAR_COLOR.mult),
    // Reihe 3: x2 | ??? | x2
    bar(W * 0.16, 800, 200, 'x2', mult(2), BAR_COLOR.mult),
    bar(W * 0.5, 800, 200, '???', mystery('risky'), BAR_COLOR.mystery),
    bar(W * 0.84, 800, 200, 'x2', mult(2), BAR_COLOR.mult),
  ],
  boosters: [
    {
      x: W * 0.3,
      y: 800,
      w: 150,
      h: 32,
      label: 'BOOST',
      effect: mult(2),
      color: BAR_COLOR.boost,
    },
  ],
  blockers: [
    post(W * 0.36, 440, 100),
    post(W * 0.64, 440, 100),
    post(W * 0.78, 640, 90),
    post(W * 0.36, 840, 80),
    post(W * 0.64, 840, 80),
  ],
  gates: [],
  bins: defaultBins(),
  maxConcurrentBalls: 250,
};

export const BOARD_REGISTRY: Record<string, BoardDef> = {
  [BOARD_BASIC.id]: BOARD_BASIC,
  [BOARD_DENSE.id]: BOARD_DENSE,
};
