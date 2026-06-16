// Drop-Board im „Fill-the-Cup"-Stil (Referenz): ein fester Spender oben schüttet
// Bälle aus, sie fallen durch horizontale MULTIPLIKATOR-BALKEN (vervielfachen die
// Ball-ANZAHL) und werden unten in einem BEWEGLICHEN Fang-Becher aufgefangen
// (ADR-009: reine Physik bestimmt das Ergebnis — Treffer im Catcher = +1).

import type { BoardDef, PegDef } from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

// Wenige, gezielt platzierte Pins als sanfte Ablenker (kein dichtes Pachinko-Feld).
function sparsePegs(rows: { y: number; xs: number[] }[]): PegDef[] {
  return rows.flatMap((row) => row.xs.map((x) => ({ x, y: row.y, radius: 8 })));
}

export const BOARD_BASIC: BoardDef = {
  id: 'board_basic',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.42,
  catcherWidth: 150,
  pegs: sparsePegs([
    { y: 360, xs: [GAME_WIDTH * 0.5] },
    { y: 560, xs: [GAME_WIDTH * 0.32, GAME_WIDTH * 0.68] },
    { y: 770, xs: [GAME_WIDTH * 0.5] },
  ]),
  // Horizontale Multiplikator-Balken — jeder vervielfacht die Ball-Anzahl.
  platforms: [
    {
      x: GAME_WIDTH * 0.2,
      y: 440,
      w: 230,
      h: 30,
      label: 'x3',
      effect: { type: 'gateMultiply', params: { factor: 3 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.68,
      y: 440,
      w: 320,
      h: 30,
      label: 'x4',
      effect: { type: 'gateMultiply', params: { factor: 4 } },
      color: 0x36d66b,
    },
    {
      x: GAME_WIDTH * 0.66,
      y: 650,
      w: 300,
      h: 28,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.24,
      y: 860,
      w: 250,
      h: 28,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.8,
      y: 860,
      w: 220,
      h: 28,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
  ],
  // Mittlerer Booster: schiebt Bälle wieder hoch (zweite Chance auf die Balken).
  boosters: [
    {
      x: GAME_WIDTH * 0.5,
      y: 850,
      w: 130,
      h: 34,
      label: '⌃',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0x4cc9f0,
    },
  ],
  // Kurze vertikale Pfosten als Leitplanken neben den Balken.
  blockers: [
    { x: GAME_WIDTH * 0.5, y: 660, w: 14, h: 90, angle: 0, color: 0xb8860b },
    { x: GAME_WIDTH * 0.62, y: 870, w: 14, h: 70, angle: 0, color: 0xb8860b },
    { x: GAME_WIDTH * 0.38, y: 870, w: 14, h: 70, angle: 0, color: 0xb8860b },
  ],
  gates: [],
  maxConcurrentBalls: 220,
};

// Zweites Board (Welt 2): mehr Balken, höhere Multiplikatoren, engere Lücken.
export const BOARD_DENSE: BoardDef = {
  id: 'board_dense',
  width: GAME_WIDTH,
  height: 1280,
  gravity: 1,
  defaultRestitution: 0.46,
  catcherWidth: 132,
  pegs: sparsePegs([
    { y: 340, xs: [GAME_WIDTH * 0.36, GAME_WIDTH * 0.64] },
    { y: 540, xs: [GAME_WIDTH * 0.5] },
    { y: 720, xs: [GAME_WIDTH * 0.28, GAME_WIDTH * 0.72] },
    { y: 900, xs: [GAME_WIDTH * 0.5] },
  ]),
  platforms: [
    {
      x: GAME_WIDTH * 0.22,
      y: 420,
      w: 220,
      h: 28,
      label: 'x4',
      effect: { type: 'gateMultiply', params: { factor: 4 } },
      color: 0x36d66b,
    },
    {
      x: GAME_WIDTH * 0.72,
      y: 420,
      w: 280,
      h: 28,
      label: 'x3',
      effect: { type: 'gateMultiply', params: { factor: 3 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.3,
      y: 620,
      w: 260,
      h: 26,
      label: 'x3',
      effect: { type: 'gateMultiply', params: { factor: 3 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.78,
      y: 760,
      w: 240,
      h: 26,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
    {
      x: GAME_WIDTH * 0.26,
      y: 900,
      w: 240,
      h: 26,
      label: 'x2',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0xf4c430,
    },
  ],
  boosters: [
    {
      x: GAME_WIDTH * 0.6,
      y: 900,
      w: 120,
      h: 32,
      label: '⌃',
      effect: { type: 'gateMultiply', params: { factor: 2 } },
      color: 0x4cc9f0,
    },
  ],
  blockers: [
    { x: GAME_WIDTH * 0.5, y: 540, w: 14, h: 90, angle: 0, color: 0xb8860b },
    { x: GAME_WIDTH * 0.44, y: 780, w: 14, h: 80, angle: -8, color: 0xb8860b },
    { x: GAME_WIDTH * 0.56, y: 780, w: 14, h: 80, angle: 8, color: 0xb8860b },
  ],
  gates: [],
  maxConcurrentBalls: 220,
};

export const BOARD_REGISTRY: Record<string, BoardDef> = {
  [BOARD_BASIC.id]: BOARD_BASIC,
  [BOARD_DENSE.id]: BOARD_DENSE,
};
