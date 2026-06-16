// Drop-Board (docs/05, docs/08 §3.6). Bälle tropfen aus dem Becher und fallen
// durch ein Feld aus horizontalen Balken (ADR-009: reine Physik bestimmt das
// Ergebnis). Balken-Wirkungen:
//   X2/X3/X4 (multiply)  · +N (add) · -N (subtract)  → verändern den Ballwert,
//   ⮝ (bounce)           → schleudert Bälle wieder nach oben,
//   🧱 (breakable)       → blockt, bis genug Bälle ihn zertrümmert haben.
// Unten fangen Bins die Bälle und multiplizieren (Near-Miss: zentraler x10).

import type { BarDef, BoardDef, PegDef } from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

const COL = {
  mult: 0xe0a020, // orange — Multiplikator
  mult4: 0x4caf50, // grün — starker Multiplikator
  sub: 0xe05050, // rot — Subtraktion
  add: 0x4cc9f0, // cyan — Addition
  bounce: 0x2d9cdb, // blau — Sprungbalken
  brick: 0x8d6e63, // braun — zerstörbarer Balken
} as const;

// Wenige, gezielt gesetzte Pegs für den Pachinko-Bounce zwischen den Balken.
function buildPegs(rows: { y: number; xs: number[] }[]): PegDef[] {
  const pegs: PegDef[] = [];
  for (const row of rows) for (const x of row.xs) pegs.push({ x, y: row.y, radius: 8 });
  return pegs;
}

const BIN_COUNT = 5;
const BIN_W = GAME_WIDTH / BIN_COUNT;
const BIN_MULTS = [1, 5, 10, 5, 1]; // x10 zentral (Near-Miss)
const makeBins = () =>
  BIN_MULTS.map((m, i) => ({ x: i * BIN_W, w: BIN_W, multiplier: m, label: `x${m}` }));

// ---- Welt 1: Basis-Board -------------------------------------------------

const BASIC_BARS: BarDef[] = [
  // Reihe 1 — Multiplikatoren direkt unter dem Becher.
  { x: 200, y: 320, w: 250, h: 26, kind: 'multiply', amount: 3, label: 'X3', color: COL.mult },
  { x: 520, y: 320, w: 300, h: 26, kind: 'multiply', amount: 4, label: 'X4', color: COL.mult4 },
  // Reihe 2 — Sprungbalken (wirft Bälle hoch) + X2.
  { x: 330, y: 470, w: 230, h: 30, kind: 'bounce', amount: 13, label: '⮝ ⮝', color: COL.bounce },
  { x: 620, y: 500, w: 150, h: 26, kind: 'multiply', amount: 2, label: 'X2', color: COL.mult },
  // Reihe 3 — Subtraktion (Risiko) + Addition.
  { x: 140, y: 560, w: 200, h: 26, kind: 'subtract', amount: 2, label: '-2', color: COL.sub },
  { x: 470, y: 600, w: 180, h: 26, kind: 'add', amount: 3, label: '+3', color: COL.add },
  // Reihe 4 — zerstörbare Balken: brauchen mehrere Bälle, bis sie zerbrechen.
  { x: 240, y: 700, w: 220, h: 32, kind: 'breakable', hp: 8, label: '', color: COL.brick },
  { x: 520, y: 720, w: 240, h: 32, kind: 'breakable', hp: 14, label: '', color: COL.brick },
  // Reihe 5 — X2 links/rechts kurz vor den Bins.
  { x: 150, y: 840, w: 220, h: 26, kind: 'multiply', amount: 2, label: 'X2', color: COL.mult },
  { x: 560, y: 840, w: 240, h: 26, kind: 'multiply', amount: 2, label: 'X2', color: COL.mult },
];

export const BOARD_BASIC: BoardDef = {
  id: 'board_basic',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.55,
  pegs: buildPegs([
    { y: 400, xs: [90, 460, 660] },
    { y: 640, xs: [330, 620] },
    { y: 780, xs: [120, 380, 650] },
  ]),
  gates: [],
  bars: BASIC_BARS,
  bins: makeBins(),
  maxConcurrentBalls: 200,
};

// ---- Welt 2: dichteres, riskanteres Board --------------------------------

const DENSE_BARS: BarDef[] = [
  { x: 180, y: 310, w: 230, h: 26, kind: 'multiply', amount: 4, label: 'X4', color: COL.mult4 },
  { x: 520, y: 310, w: 300, h: 26, kind: 'multiply', amount: 3, label: 'X3', color: COL.mult },
  { x: 360, y: 440, w: 260, h: 30, kind: 'bounce', amount: 15, label: '⮝ ⮝', color: COL.bounce },
  { x: 120, y: 520, w: 200, h: 26, kind: 'subtract', amount: 3, label: '-3', color: COL.sub },
  { x: 600, y: 520, w: 180, h: 26, kind: 'subtract', amount: 2, label: '-2', color: COL.sub },
  { x: 360, y: 600, w: 220, h: 26, kind: 'add', amount: 5, label: '+5', color: COL.add },
  { x: 220, y: 700, w: 220, h: 32, kind: 'breakable', hp: 12, label: '', color: COL.brick },
  { x: 520, y: 700, w: 220, h: 32, kind: 'breakable', hp: 12, label: '', color: COL.brick },
  { x: 360, y: 820, w: 260, h: 28, kind: 'multiply', amount: 2, label: 'X2', color: COL.mult },
];

export const BOARD_DENSE: BoardDef = {
  id: 'board_dense',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.6,
  pegs: buildPegs([
    { y: 380, xs: [90, 250, 470, 650] },
    { y: 560, xs: [240, 480] },
    { y: 760, xs: [120, 300, 440, 620] },
  ]),
  gates: [],
  bars: DENSE_BARS,
  bins: makeBins(),
  maxConcurrentBalls: 200,
};

export const BOARD_REGISTRY: Record<string, BoardDef> = {
  [BOARD_BASIC.id]: BOARD_BASIC,
  [BOARD_DENSE.id]: BOARD_DENSE,
};
