// Datengetriebener Board-Generator für Pachinko-Layouts.
// Erzeugt deterministische Varianten aus Seed, Difficulty und Wave, hält Cup- und
// Funnel-Zonen frei und nutzt bewusste Zonen/Pattern statt komplettem Zufall.

import { Rng } from '@/core/rng/Rng';
import type {
  BinDef,
  BoardBlockerDef,
  BoardBoosterDef,
  BoardDef,
  BoardPlatformDef,
  BoardRampDef,
  GateDef,
  PegDef,
} from '@/types/content';
import { GAME_WIDTH } from '@/ui/layout';

const BOARD_HEIGHT = 1280;
const CUP_Y = 180;
const CUP_CLEARANCE = 110;
const FUNNEL_TOP_Y = 1030;
const SAFE_TOP_Y = CUP_Y + CUP_CLEARANCE;
const SAFE_BOTTOM_Y = FUNNEL_TOP_Y - 35;
const PEG_RADIUS = 7;
const BIN_COUNT = 5;
const MAX_CONCURRENT_BALLS = 200;

export const GATE_COSTS = {
  add: 9,
  multiply: 16,
  multiplierStep: 7,
  addStep: 1,
} as const;
export const PLATFORM_COSTS = {
  add: 11,
  multiply: 19,
  multiplierStep: 8,
  addStep: 1,
  widthDiscountThreshold: 190,
  wideDiscount: 4,
} as const;
export const BOOSTER_COST = 18;
export const MYSTERY_COST = 14;
export const BLOCKER_RISK_CREDIT = 8;
export const MAX_MULTIPLIER_BY_DIFFICULTY: ReadonlyArray<{
  maxDifficulty: number;
  multiplier: number;
}> = [
  { maxDifficulty: 3, multiplier: 3 },
  { maxDifficulty: 6, multiplier: 4 },
  { maxDifficulty: 9, multiplier: 5 },
  { maxDifficulty: Number.POSITIVE_INFINITY, multiplier: 6 },
];

type PatternName = 'balanced' | 'zigzag' | 'centerRisk' | 'wideChaos';

interface PatternTemplate {
  name: PatternName;
  rampSlots: Array<{ xRatio: number; y: number; angle: number; w: number; label: string }>;
  platformSlots: Array<{ xRatio: number; y: number; w: number; labelKind: 'multiply' | 'add' }>;
  gateSlots: Array<{ xRatio: number; y: number; kind: 'multiply' | 'add' }>;
  boosterSlots: Array<{ xRatio: number; y: number; angle?: number }>;
  blockerSlots: Array<{ xRatio: number; y: number; angle: number; h: number }>;
}

const PATTERNS: PatternTemplate[] = [
  {
    name: 'balanced',
    rampSlots: [
      { xRatio: 0.2, y: 455, angle: -22, w: 170, label: '↘' },
      { xRatio: 0.8, y: 455, angle: 22, w: 170, label: '↙' },
      { xRatio: 0.28, y: 820, angle: 18, w: 150, label: '↙' },
      { xRatio: 0.72, y: 820, angle: -18, w: 150, label: '↘' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 545, w: 230, labelKind: 'multiply' },
      { xRatio: 0.35, y: 735, w: 190, labelKind: 'add' },
      { xRatio: 0.65, y: 920, w: 190, labelKind: 'multiply' },
    ],
    gateSlots: [
      { xRatio: 0.3, y: 660, kind: 'multiply' },
      { xRatio: 0.7, y: 660, kind: 'add' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 690 }],
    blockerSlots: [{ xRatio: 0.5, y: 1005, angle: 0, h: 95 }],
  },
  {
    name: 'zigzag',
    rampSlots: [
      { xRatio: 0.24, y: 430, angle: -26, w: 165, label: '↘' },
      { xRatio: 0.74, y: 590, angle: 24, w: 160, label: '↙' },
      { xRatio: 0.3, y: 780, angle: 22, w: 165, label: '↙' },
      { xRatio: 0.68, y: 910, angle: -20, w: 145, label: '↘' },
    ],
    platformSlots: [
      { xRatio: 0.62, y: 510, w: 170, labelKind: 'add' },
      { xRatio: 0.38, y: 700, w: 175, labelKind: 'multiply' },
      { xRatio: 0.55, y: 885, w: 160, labelKind: 'add' },
    ],
    gateSlots: [
      { xRatio: 0.24, y: 645, kind: 'add' },
      { xRatio: 0.76, y: 745, kind: 'multiply' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 805, angle: -8 }],
    blockerSlots: [
      { xRatio: 0.42, y: 1000, angle: -10, h: 105 },
      { xRatio: 0.58, y: 1000, angle: 10, h: 105 },
    ],
  },
  {
    name: 'centerRisk',
    rampSlots: [
      { xRatio: 0.18, y: 420, angle: -28, w: 175, label: '↘' },
      { xRatio: 0.82, y: 420, angle: 28, w: 175, label: '↙' },
      { xRatio: 0.5, y: 930, angle: 14, w: 150, label: 'tilt' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 525, w: 190, labelKind: 'multiply' },
      { xRatio: 0.28, y: 710, w: 155, labelKind: 'add' },
      { xRatio: 0.72, y: 875, w: 155, labelKind: 'multiply' },
    ],
    gateSlots: [
      { xRatio: 0.28, y: 700, kind: 'multiply' },
      { xRatio: 0.72, y: 700, kind: 'add' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 735 }],
    blockerSlots: [
      { xRatio: 0.45, y: 995, angle: -8, h: 105 },
      { xRatio: 0.55, y: 995, angle: 8, h: 105 },
    ],
  },
  {
    name: 'wideChaos',
    rampSlots: [
      { xRatio: 0.18, y: 500, angle: -24, w: 155, label: '↘' },
      { xRatio: 0.82, y: 500, angle: 24, w: 155, label: '↙' },
      { xRatio: 0.22, y: 860, angle: 20, w: 145, label: '↙' },
      { xRatio: 0.78, y: 860, angle: -20, w: 145, label: '↘' },
    ],
    platformSlots: [
      { xRatio: 0.22, y: 630, w: 145, labelKind: 'add' },
      { xRatio: 0.5, y: 760, w: 170, labelKind: 'multiply' },
      { xRatio: 0.78, y: 630, w: 145, labelKind: 'add' },
    ],
    gateSlots: [
      { xRatio: 0.35, y: 575, kind: 'multiply' },
      { xRatio: 0.65, y: 575, kind: 'multiply' },
    ],
    boosterSlots: [
      { xRatio: 0.32, y: 830, angle: 8 },
      { xRatio: 0.68, y: 830, angle: -8 },
    ],
    blockerSlots: [{ xRatio: 0.5, y: 1005, angle: 0, h: 100 }],
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jitter(rng: Rng, amount: number): number {
  return rng.intBetween(-amount, amount);
}

function scaledDifficulty(difficulty: number, wave: number): number {
  return clamp(Math.round(difficulty + wave * 0.35), 1, 12);
}

function buildPegs(rng: Rng, challenge: number): PegDef[] {
  const pegs: PegDef[] = [];
  const rows = clamp(5 + Math.floor(challenge / 3), 5, 8);
  const rowGap = clamp(92 - challenge * 3, 66, 92);
  const colGap = clamp(132 - challenge * 4, 92, 132);
  const top = SAFE_TOP_Y + 40;

  for (let row = 0; row < rows; row++) {
    const y = top + row * rowGap;
    if (y > SAFE_BOTTOM_Y - 130) break;

    const offset = row % 2 === 0 ? colGap * 0.48 : colGap * 0.9;
    for (let x = offset; x <= GAME_WIDTH - 38; x += colGap) {
      const edgePadding = 34;
      pegs.push({
        x: clamp(Math.round(x + jitter(rng, 9)), edgePadding, GAME_WIDTH - edgePadding),
        y: Math.round(y + jitter(rng, 7)),
        radius: PEG_RADIUS,
      });
    }
  }

  return pegs;
}

function maxMultiplierForDifficulty(challenge: number): number {
  return (
    MAX_MULTIPLIER_BY_DIFFICULTY.find((entry) => challenge <= entry.maxDifficulty)?.multiplier ?? 5
  );
}

function effectValue(kind: 'multiply' | 'add', challenge: number, rng: Rng, riskScore = 0): number {
  if (kind === 'multiply') {
    const riskBonus = riskScore >= 5 ? 1 : 0;
    const safePenalty = riskScore <= 2 ? 1 : 0;
    return clamp(
      2 + Math.floor((challenge + rng.intBetween(0, 2)) / 4) + riskBonus - safePenalty,
      2,
      maxMultiplierForDifficulty(challenge),
    );
  }
  return clamp(3 + challenge + rng.intBetween(0, 3), 4, 16);
}

function effectFor(kind: 'multiply' | 'add', value: number) {
  return kind === 'multiply'
    ? { type: 'gateMultiply' as const, params: { factor: value } }
    : { type: 'gateAdd' as const, params: { amount: value } };
}

export function buildBoardBudget(difficulty: number, wave: number, chapter: number): number {
  const challenge = scaledDifficulty(difficulty, wave);
  const chapterBonus = Math.max(0, chapter - 1) * 10;
  return 54 + challenge * 7 + chapterBonus;
}

function slotRiskScore(
  slot: { xRatio: number; y: number; w?: number },
  blockerCount: number,
): number {
  const centerRisk = 1 - Math.min(1, Math.abs(slot.xRatio - 0.5) / 0.5);
  const depthRisk = clamp((slot.y - SAFE_TOP_Y) / (SAFE_BOTTOM_Y - SAFE_TOP_Y), 0, 1);
  const narrowRisk = slot.w ? clamp((210 - slot.w) / 90, 0, 1) : 0.45;
  return centerRisk * 3 + depthRisk * 2 + narrowRisk * 2 + blockerCount * 0.5;
}

function gateCost(kind: 'multiply' | 'add', value: number): number {
  if (kind === 'multiply') return GATE_COSTS.multiply + (value - 2) * GATE_COSTS.multiplierStep;
  return GATE_COSTS.add + Math.max(0, value - 4) * GATE_COSTS.addStep;
}

function platformCost(kind: 'multiply' | 'add', value: number, width: number): number {
  const base =
    kind === 'multiply'
      ? PLATFORM_COSTS.multiply + (value - 2) * PLATFORM_COSTS.multiplierStep
      : PLATFORM_COSTS.add + Math.max(0, value - 4) * PLATFORM_COSTS.addStep;
  return Math.max(
    1,
    base - (width >= PLATFORM_COSTS.widthDiscountThreshold ? PLATFORM_COSTS.wideDiscount : 0),
  );
}

function spendBudget(budget: { remaining: number }, cost: number): boolean {
  if (budget.remaining < cost) return false;
  budget.remaining -= cost;
  return true;
}

function buildPatternObjects(
  pattern: PatternTemplate,
  rng: Rng,
  challenge: number,
  budgetLimit: number,
) {
  const budget = { remaining: budgetLimit + pattern.blockerSlots.length * BLOCKER_RISK_CREDIT };
  const blockerCount = pattern.blockerSlots.length;

  const gateCandidates = pattern.gateSlots
    .map((slot) => ({ slot, riskScore: slotRiskScore(slot, blockerCount) }))
    .sort((a, b) => b.riskScore - a.riskScore);
  const gates: GateDef[] = [];
  for (const { slot, riskScore } of gateCandidates) {
    const value = effectValue(slot.kind, challenge, rng, riskScore);
    if (!spendBudget(budget, gateCost(slot.kind, value))) continue;
    const prefix = slot.kind === 'multiply' ? 'x' : '+';
    gates.push({
      x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 18)),
      y: clamp(slot.y + jitter(rng, 18), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: 76,
      h: 24,
      label: `${prefix}${value}`,
      effect: effectFor(slot.kind, value),
    });
  }

  const platformCandidates = pattern.platformSlots
    .map((slot) => ({ slot, riskScore: slotRiskScore(slot, blockerCount) }))
    .sort((a, b) => {
      if (a.slot.labelKind !== b.slot.labelKind) return a.slot.labelKind === 'multiply' ? -1 : 1;
      return a.slot.labelKind === 'multiply'
        ? b.riskScore - a.riskScore
        : a.riskScore - b.riskScore;
    });
  const platforms: BoardPlatformDef[] = [];
  for (const { slot, riskScore } of platformCandidates) {
    const value = effectValue(slot.labelKind, challenge, rng, riskScore);
    if (!spendBudget(budget, platformCost(slot.labelKind, value, slot.w))) continue;
    const prefix = slot.labelKind === 'multiply' ? 'x' : '+';
    platforms.push({
      x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 20)),
      y: clamp(slot.y + jitter(rng, 16), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: slot.w,
      h: 26,
      angle: jitter(rng, 5),
      label: `${prefix}${value}`,
      effect: effectFor(slot.labelKind, value),
      color: slot.labelKind === 'multiply' ? 0xf4c430 : 0x36d66b,
    });
  }

  const ramps: BoardRampDef[] = pattern.rampSlots.map((slot) => ({
    x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 14)),
    y: clamp(slot.y + jitter(rng, 14), SAFE_TOP_Y, SAFE_BOTTOM_Y),
    w: slot.w,
    h: 16,
    angle: slot.angle + jitter(rng, 4),
    label: slot.label,
    color: 0xd7f3ff,
  }));

  const boosters: BoardBoosterDef[] = [];
  for (const slot of pattern.boosterSlots) {
    if (!spendBudget(budget, BOOSTER_COST)) continue;
    boosters.push({
      x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 16)),
      y: clamp(slot.y + jitter(rng, 16), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: 106,
      h: 40,
      angle: slot.angle ?? 0,
      label: 'BOOST',
      effect: effectFor('add', clamp(2 + Math.floor(challenge / 2), 3, 8)),
      color: 0xff4fd8,
    });
  }

  const blockers: BoardBlockerDef[] = pattern.blockerSlots.map((slot) => ({
    x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 10)),
    y: clamp(slot.y + jitter(rng, 10), SAFE_TOP_Y, SAFE_BOTTOM_Y),
    w: 14,
    h: slot.h,
    angle: slot.angle,
    label: 'risk',
    color: 0xff6b6b,
  }));

  return { gates, platforms, ramps, boosters, blockers };
}

function buildBins(challenge: number, rng: Rng, budgetLimit: number): BinDef[] {
  const binW = GAME_WIDTH / BIN_COUNT;
  const jackpot = clamp(8 + Math.floor(challenge / 2) + rng.intBetween(0, 2), 8, 16);
  const shoulder = clamp(3 + Math.floor(challenge / 3), 3, 7);
  const outer = challenge >= 8 ? 0.5 : 1;
  const multipliers = [outer, shoulder, jackpot, shoulder, outer];

  let remaining = Math.max(0, Math.floor(budgetLimit * 0.2));

  return multipliers.map((multiplier, index) => {
    const bin: BinDef = {
      x: index * binW,
      w: binW,
      multiplier,
      label: `x${multiplier}`,
    };

    const isRiskyJackpot = index === Math.floor(BIN_COUNT / 2) && multiplier === jackpot;
    if (isRiskyJackpot && remaining >= MYSTERY_COST && challenge >= 5) {
      remaining -= MYSTERY_COST;
      bin.special = effectFor('add', clamp(2 + Math.floor(challenge / 2), 4, 9));
      bin.label = `${bin.label} ?`;
    }

    return bin;
  });
}

/**
 * Erzeugt ein vollständiges, deterministisches Pachinko-Board.
 * Gleiche Eingaben liefern immer dasselbe Layout; Difficulty und Wave erhöhen
 * Peg-Dichte, Varianz und Bonuswerte schrittweise.
 */
export function generateBoard(
  seed: number,
  difficulty: number,
  wave: number,
  chapter = 1,
): BoardDef {
  const rng = new Rng(
    (seed ^ Math.imul(difficulty, 0x45d9f3b) ^ Math.imul(wave, 0x119de1f3)) >>> 0,
  );
  const challenge = scaledDifficulty(difficulty, wave);
  const pattern = PATTERNS[rng.intBetween(0, PATTERNS.length - 1)];
  const budget = buildBoardBudget(difficulty, wave, chapter);
  const patternObjects = buildPatternObjects(pattern, rng, challenge, budget);

  return {
    id: `board_generated_${seed}_${difficulty}_${wave}_${chapter}_${pattern.name}`,
    width: GAME_WIDTH,
    height: BOARD_HEIGHT,
    gravity: 1,
    defaultRestitution: clamp(0.48 + challenge * 0.01, 0.5, 0.62),
    pegs: buildPegs(rng, challenge),
    ...patternObjects,
    bins: buildBins(challenge, rng, budget),
    maxConcurrentBalls: MAX_CONCURRENT_BALLS,
  };
}
