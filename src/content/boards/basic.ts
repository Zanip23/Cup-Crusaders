// Basis-Board für die Drop-Phase (docs/05, docs/08 §3.6). Near-Miss-Layout:
// zentraler x10-Bin, flankiert von kleineren — Layout/Gefühl, keine versteckte
// Mathematik (ADR-009: reine Physik bestimmt das Ergebnis).

import type { BoardDef, PegDef } from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

const PEG_TOP = 330;
const PEG_ROWS = 5;
const ROW_GAP = 92;
const COL_GAP = 130;

function buildPegs(): PegDef[] {
  const pegs: PegDef[] = [];
  for (let row = 0; row < PEG_ROWS; row++) {
    const y = PEG_TOP + row * ROW_GAP;
    const offset = row % 2 === 0 ? 68 : 132;
    for (let x = offset; x <= GAME_WIDTH - 40; x += COL_GAP) {
      pegs.push({ x, y, radius: 7 });
    }
  }
  return pegs;
}

const BIN_COUNT = 5;
const BIN_W = GAME_WIDTH / BIN_COUNT;
const BIN_MULTS = [1, 5, 10, 5, 1]; // x10 zentral (Near-Miss)

export const BOARD_BASIC: BoardDef = {
  id: 'board_basic',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.5,
  pegs: buildPegs(),
  bumpers: [
    { x: GAME_WIDTH * 0.22, y: 610, radius: 24, label: 'BOUNCE', color: 0x4cc9f0 },
    { x: GAME_WIDTH * 0.78, y: 610, radius: 24, label: 'BOUNCE', color: 0x4cc9f0 },
  ],
  ramps: [
    { x: GAME_WIDTH * 0.19, y: 455, w: 170, h: 16, angle: -22, label: '↘', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.81, y: 455, w: 170, h: 16, angle: 22, label: '↙', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.27, y: 820, w: 150, h: 16, angle: 18, label: '↙', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.73, y: 820, w: 150, h: 16, angle: -18, label: '↘', color: 0xd7f3ff },
  ],
  platforms: [
    {
      x: GAME_WIDTH * 0.5,
      y: 545,
      w: 230,
      h: 28,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.35,
      y: 735,
      w: 190,
      h: 26,
      label: '+5',
      effect: { type: 'gateAdd', params: { amount: 5 } },
      color: 0x36d66b,
    },
    {
      x: GAME_WIDTH * 0.65,
      y: 920,
      w: 190,
      h: 26,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
  ],
  boosters: [
    {
      x: GAME_WIDTH * 0.5,
      y: 690,
      w: 112,
      h: 42,
      label: 'BOOST',
      effect: { type: 'gateAdd', params: { amount: 3 } },
      color: 0xff4fd8,
    },
  ],
  blockers: [
    { x: GAME_WIDTH * 0.5, y: 1040, w: 14, h: 120, angle: 0, label: 'risk', color: 0xff6b6b },
  ],
  gates: [
    {
      x: GAME_WIDTH * 0.3,
      y: 660,
      w: 76,
      h: 24,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
    },
    {
      x: GAME_WIDTH * 0.7,
      y: 660,
      w: 76,
      h: 24,
      label: '+5',
      effect: { type: 'gateAdd', params: { amount: 5 } },
    },
  ],
  bins: BIN_MULTS.map((m, i) => ({
    x: i * BIN_W,
    w: BIN_W,
    multiplier: m,
    label: `x${m}`,
  })),
  maxConcurrentBalls: 200,
};

// Zweites, dichteres Board (Welt 2): mehr Hindernisse, stärkere Tore (x3 / +10),
// aggressivere Rampen und schmalere Bonus-Zonen. Höheres Chaos → höhere Varianz.
function buildPegsDense(): PegDef[] {
  const pegs: PegDef[] = [];
  const rows = 7;
  for (let row = 0; row < rows; row++) {
    const y = 275 + row * 70;
    const offset = row % 2 === 0 ? 46 : 98;
    for (let x = offset; x <= GAME_WIDTH - 30; x += 112) {
      pegs.push({ x, y, radius: 7 });
    }
  }
  return pegs;
}

export const BOARD_DENSE: BoardDef = {
  id: 'board_dense',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.55,
  pegs: buildPegsDense(),
  bumpers: [
    { x: GAME_WIDTH * 0.18, y: 540, radius: 22, label: 'CHAOS', color: 0xff6b6b },
    { x: GAME_WIDTH * 0.5, y: 650, radius: 28, label: 'CHAOS', color: 0xff6b6b },
    { x: GAME_WIDTH * 0.82, y: 540, radius: 22, label: 'CHAOS', color: 0xff6b6b },
  ],
  ramps: [
    { x: GAME_WIDTH * 0.2, y: 420, w: 175, h: 16, angle: -28, label: '↘', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.8, y: 420, w: 175, h: 16, angle: 28, label: '↙', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.29, y: 790, w: 170, h: 16, angle: 25, label: '↙', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.71, y: 790, w: 170, h: 16, angle: -25, label: '↘', color: 0xd7f3ff },
    { x: GAME_WIDTH * 0.5, y: 940, w: 150, h: 14, angle: 15, label: 'tilt', color: 0xd7f3ff },
  ],
  platforms: [
    {
      x: GAME_WIDTH * 0.5,
      y: 520,
      w: 190,
      h: 26,
      label: 'x3',
      effect: { type: 'gateMultiply', params: { factor: 3 } },
      color: 0x36d66b,
    },
    {
      x: GAME_WIDTH * 0.28,
      y: 705,
      w: 150,
      h: 24,
      label: '+10',
      effect: { type: 'gateAdd', params: { amount: 10 } },
      color: 0x4cc9f0,
    },
    {
      x: GAME_WIDTH * 0.72,
      y: 875,
      w: 150,
      h: 24,
      label: 'x4',
      effect: { type: 'gateMultiply', params: { factor: 4 } },
      color: 0xf4c430,
    },
  ],
  boosters: [
    {
      x: GAME_WIDTH * 0.5,
      y: 735,
      w: 104,
      h: 40,
      label: 'BOOST',
      effect: { type: 'gateAdd', params: { amount: 5 } },
      color: 0xff4fd8,
    },
  ],
  blockers: [
    { x: GAME_WIDTH * 0.42, y: 1010, w: 14, h: 130, angle: -10, label: 'risk', color: 0xff6b6b },
    { x: GAME_WIDTH * 0.58, y: 1010, w: 14, h: 130, angle: 10, label: 'risk', color: 0xff6b6b },
  ],
  gates: [
    {
      x: GAME_WIDTH * 0.28,
      y: 700,
      w: 76,
      h: 24,
      label: 'x3',
      effect: { type: 'gateMultiply', params: { factor: 3 } },
    },
    {
      x: GAME_WIDTH * 0.72,
      y: 700,
      w: 76,
      h: 24,
      label: '+10',
      effect: { type: 'gateAdd', params: { amount: 10 } },
    },
  ],
  bins: BIN_MULTS.map((m, i) => ({ x: i * BIN_W, w: BIN_W, multiplier: m, label: `x${m}` })),
  maxConcurrentBalls: 200,
};

export const BOARD_REGISTRY: Record<string, BoardDef> = {
  [BOARD_BASIC.id]: BOARD_BASIC,
  [BOARD_DENSE.id]: BOARD_DENSE,
};
