// Basis-Board für die Drop-Phase (docs/05, docs/08 §3.6). Near-Miss-Layout:
// zentraler x10-Bin, flankiert von kleineren — Layout/Gefühl, keine versteckte
// Mathematik (ADR-009: reine Physik bestimmt das Ergebnis).

import type { BoardDef, PegDef } from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

const PEG_TOP = 300;
const PEG_ROWS = 7;
const ROW_GAP = 78;
const COL_GAP = 100;

function buildPegs(): PegDef[] {
  const pegs: PegDef[] = [];
  for (let row = 0; row < PEG_ROWS; row++) {
    const y = PEG_TOP + row * ROW_GAP;
    const offset = row % 2 === 0 ? 60 : 110;
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

export const BOARD_REGISTRY: Record<string, BoardDef> = {
  [BOARD_BASIC.id]: BOARD_BASIC,
};
