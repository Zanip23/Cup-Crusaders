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

export type BoardTemplateId =
  | 'classic'
  | 'snake'
  | 'split_choice'
  | 'booster_tunnel'
  | 'bonus_trap'
  | 'rain'
  | 'risk_wall';

type RiskRewardProfile = 'safe' | 'balanced' | 'swingy' | 'highRisk';

interface BoardZone {
  xMinRatio: number;
  xMaxRatio: number;
  yMin: number;
  yMax: number;
}

interface BinDistribution {
  outer: number;
  shoulder: number;
  center: number;
  mysteryCenterFromChallenge: number;
}

interface BoardTemplate {
  id: BoardTemplateId;
  pegZones: BoardZone[];
  gateZones: BoardZone[];
  rampAngles: { min: number; max: number };
  boosterPositions: BoardZone[];
  binDistribution: BinDistribution;
  riskRewardProfile: RiskRewardProfile;

  rampSlots: Array<{ xRatio: number; y: number; angle: number; w: number; label: string }>;
  platformSlots: Array<{ xRatio: number; y: number; w: number; labelKind: 'multiply' | 'add' }>;
  gateSlots: Array<{ xRatio: number; y: number; kind: 'multiply' | 'add' }>;
  boosterSlots: Array<{ xRatio: number; y: number; angle?: number }>;
  blockerSlots: Array<{ xRatio: number; y: number; angle: number; h: number }>;
}

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'classic',
    pegZones: [
      { xMinRatio: 0.08, xMaxRatio: 0.92, yMin: SAFE_TOP_Y + 20, yMax: SAFE_BOTTOM_Y - 150 },
    ],
    gateZones: [{ xMinRatio: 0.18, xMaxRatio: 0.82, yMin: 560, yMax: 760 }],
    rampAngles: { min: -26, max: 26 },
    boosterPositions: [{ xMinRatio: 0.42, xMaxRatio: 0.58, yMin: 610, yMax: 760 }],
    binDistribution: { outer: 1, shoulder: 1, center: 1, mysteryCenterFromChallenge: 7 },
    riskRewardProfile: 'balanced',
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
    id: 'snake',
    pegZones: [
      { xMinRatio: 0.12, xMaxRatio: 0.88, yMin: SAFE_TOP_Y + 30, yMax: SAFE_BOTTOM_Y - 120 },
    ],
    gateZones: [{ xMinRatio: 0.16, xMaxRatio: 0.84, yMin: 610, yMax: 790 }],
    rampAngles: { min: -30, max: 28 },
    boosterPositions: [{ xMinRatio: 0.42, xMaxRatio: 0.58, yMin: 740, yMax: 860 }],
    binDistribution: { outer: 0.9, shoulder: 1.05, center: 1.15, mysteryCenterFromChallenge: 6 },
    riskRewardProfile: 'swingy',
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
    id: 'split_choice',
    pegZones: [
      { xMinRatio: 0.07, xMaxRatio: 0.43, yMin: SAFE_TOP_Y + 25, yMax: SAFE_BOTTOM_Y - 130 },
      { xMinRatio: 0.57, xMaxRatio: 0.93, yMin: SAFE_TOP_Y + 25, yMax: SAFE_BOTTOM_Y - 130 },
    ],
    gateZones: [{ xMinRatio: 0.2, xMaxRatio: 0.8, yMin: 640, yMax: 760 }],
    rampAngles: { min: -32, max: 32 },
    boosterPositions: [{ xMinRatio: 0.44, xMaxRatio: 0.56, yMin: 680, yMax: 790 }],
    binDistribution: { outer: 0.75, shoulder: 1.1, center: 1.35, mysteryCenterFromChallenge: 5 },
    riskRewardProfile: 'highRisk',
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
    id: 'booster_tunnel',
    pegZones: [
      { xMinRatio: 0.12, xMaxRatio: 0.88, yMin: SAFE_TOP_Y + 50, yMax: SAFE_BOTTOM_Y - 140 },
    ],
    gateZones: [{ xMinRatio: 0.24, xMaxRatio: 0.76, yMin: 520, yMax: 650 }],
    rampAngles: { min: -28, max: 28 },
    boosterPositions: [{ xMinRatio: 0.26, xMaxRatio: 0.74, yMin: 780, yMax: 875 }],
    binDistribution: { outer: 0.8, shoulder: 1.15, center: 1.2, mysteryCenterFromChallenge: 6 },
    riskRewardProfile: 'swingy',
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

  {
    id: 'bonus_trap',
    pegZones: [
      { xMinRatio: 0.1, xMaxRatio: 0.9, yMin: SAFE_TOP_Y + 35, yMax: SAFE_BOTTOM_Y - 115 },
    ],
    gateZones: [{ xMinRatio: 0.32, xMaxRatio: 0.68, yMin: 600, yMax: 800 }],
    rampAngles: { min: -24, max: 24 },
    boosterPositions: [{ xMinRatio: 0.18, xMaxRatio: 0.82, yMin: 660, yMax: 900 }],
    binDistribution: { outer: 0.65, shoulder: 1.25, center: 1.45, mysteryCenterFromChallenge: 4 },
    riskRewardProfile: 'highRisk',
    rampSlots: [
      { xRatio: 0.16, y: 520, angle: -18, w: 145, label: 'trap' },
      { xRatio: 0.84, y: 520, angle: 18, w: 145, label: 'trap' },
      { xRatio: 0.5, y: 885, angle: 0, w: 135, label: 'bonus' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 615, w: 150, labelKind: 'multiply' },
      { xRatio: 0.24, y: 785, w: 155, labelKind: 'add' },
      { xRatio: 0.76, y: 785, w: 155, labelKind: 'add' },
    ],
    gateSlots: [
      { xRatio: 0.5, y: 690, kind: 'multiply' },
      { xRatio: 0.5, y: 810, kind: 'add' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 760, angle: 0 }],
    blockerSlots: [
      { xRatio: 0.38, y: 985, angle: -14, h: 115 },
      { xRatio: 0.62, y: 985, angle: 14, h: 115 },
    ],
  },
  {
    id: 'rain',
    pegZones: [
      { xMinRatio: 0.06, xMaxRatio: 0.94, yMin: SAFE_TOP_Y + 15, yMax: SAFE_BOTTOM_Y - 170 },
    ],
    gateZones: [{ xMinRatio: 0.18, xMaxRatio: 0.82, yMin: 500, yMax: 820 }],
    rampAngles: { min: -16, max: 16 },
    boosterPositions: [{ xMinRatio: 0.35, xMaxRatio: 0.65, yMin: 820, yMax: 940 }],
    binDistribution: { outer: 1.15, shoulder: 1, center: 0.9, mysteryCenterFromChallenge: 8 },
    riskRewardProfile: 'safe',
    rampSlots: [
      { xRatio: 0.25, y: 585, angle: -12, w: 170, label: 'drip' },
      { xRatio: 0.75, y: 585, angle: 12, w: 170, label: 'drip' },
      { xRatio: 0.5, y: 840, angle: 8, w: 190, label: 'flow' },
    ],
    platformSlots: [
      { xRatio: 0.32, y: 500, w: 175, labelKind: 'add' },
      { xRatio: 0.68, y: 735, w: 175, labelKind: 'add' },
      { xRatio: 0.5, y: 925, w: 210, labelKind: 'multiply' },
    ],
    gateSlots: [
      { xRatio: 0.32, y: 650, kind: 'add' },
      { xRatio: 0.68, y: 650, kind: 'add' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 880, angle: 0 }],
    blockerSlots: [{ xRatio: 0.5, y: 1010, angle: 0, h: 80 }],
  },
  {
    id: 'risk_wall',
    pegZones: [
      { xMinRatio: 0.14, xMaxRatio: 0.86, yMin: SAFE_TOP_Y + 40, yMax: SAFE_BOTTOM_Y - 125 },
    ],
    gateZones: [{ xMinRatio: 0.22, xMaxRatio: 0.78, yMin: 580, yMax: 890 }],
    rampAngles: { min: -34, max: 34 },
    boosterPositions: [{ xMinRatio: 0.2, xMaxRatio: 0.8, yMin: 700, yMax: 900 }],
    binDistribution: { outer: 0.5, shoulder: 1, center: 1.6, mysteryCenterFromChallenge: 4 },
    riskRewardProfile: 'highRisk',
    rampSlots: [
      { xRatio: 0.22, y: 470, angle: -30, w: 160, label: '↘' },
      { xRatio: 0.78, y: 470, angle: 30, w: 160, label: '↙' },
      { xRatio: 0.5, y: 805, angle: -22, w: 155, label: 'wall' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 585, w: 155, labelKind: 'multiply' },
      { xRatio: 0.3, y: 875, w: 150, labelKind: 'multiply' },
      { xRatio: 0.7, y: 875, w: 150, labelKind: 'add' },
    ],
    gateSlots: [
      { xRatio: 0.4, y: 720, kind: 'multiply' },
      { xRatio: 0.6, y: 720, kind: 'multiply' },
    ],
    boosterSlots: [{ xRatio: 0.5, y: 820, angle: -10 }],
    blockerSlots: [
      { xRatio: 0.43, y: 950, angle: -4, h: 125 },
      { xRatio: 0.5, y: 980, angle: 0, h: 130 },
      { xRatio: 0.57, y: 950, angle: 4, h: 125 },
    ],
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

function isInZone(x: number, y: number, zone: BoardZone): boolean {
  return (
    x >= GAME_WIDTH * zone.xMinRatio &&
    x <= GAME_WIDTH * zone.xMaxRatio &&
    y >= zone.yMin &&
    y <= zone.yMax
  );
}

function isInAnyZone(x: number, y: number, zones: BoardZone[]): boolean {
  return zones.some((zone) => isInZone(x, y, zone));
}

function zoneAwarePoint(
  slot: { xRatio: number; y: number },
  zones: BoardZone[],
  rng: Rng,
  xJitter: number,
  yJitter: number,
): { x: number; y: number } {
  const matchingZone =
    zones.find((zone) => isInZone(GAME_WIDTH * slot.xRatio, slot.y, zone)) ?? zones[0];
  const x = Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, xJitter));
  const y = slot.y + jitter(rng, yJitter);

  return {
    x: clamp(
      Math.round(x),
      GAME_WIDTH * matchingZone.xMinRatio,
      GAME_WIDTH * matchingZone.xMaxRatio,
    ),
    y: clamp(y, matchingZone.yMin, matchingZone.yMax),
  };
}

export function pickTemplate(rng: Rng, difficulty: number, wave: number): BoardTemplateId {
  const challenge = scaledDifficulty(difficulty, wave);
  return rng.weightedPick(BOARD_TEMPLATES, (template) => {
    const waveCycleBonus = (wave + template.id.length) % BOARD_TEMPLATES.length === 0 ? 2 : 0;
    const riskWeight =
      template.riskRewardProfile === 'safe'
        ? clamp(8 - challenge, 1, 7)
        : template.riskRewardProfile === 'balanced'
          ? 6
          : template.riskRewardProfile === 'swingy'
            ? clamp(3 + challenge * 0.45, 3, 8)
            : clamp(challenge - 1, 1, 9);

    return riskWeight + waveCycleBonus;
  }).id;
}

function templateById(id: BoardTemplateId): BoardTemplate {
  return BOARD_TEMPLATES.find((template) => template.id === id) ?? BOARD_TEMPLATES[0];
}

function buildPegs(rng: Rng, challenge: number, template: BoardTemplate): PegDef[] {
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
      const peg = {
        x: clamp(Math.round(x + jitter(rng, 9)), edgePadding, GAME_WIDTH - edgePadding),
        y: Math.round(y + jitter(rng, 7)),
        radius: PEG_RADIUS,
      };
      if (isInAnyZone(peg.x, peg.y, template.pegZones)) pegs.push(peg);
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
  template: BoardTemplate,
  rng: Rng,
  challenge: number,
  budgetLimit: number,
) {
  const budget = { remaining: budgetLimit + template.blockerSlots.length * BLOCKER_RISK_CREDIT };
  const blockerCount = template.blockerSlots.length;

  const gateCandidates = template.gateSlots
    .map((slot) => ({ slot, riskScore: slotRiskScore(slot, blockerCount) }))
    .sort((a, b) => b.riskScore - a.riskScore);
  const gates: GateDef[] = [];
  for (const { slot, riskScore } of gateCandidates) {
    const value = effectValue(slot.kind, challenge, rng, riskScore);
    if (!spendBudget(budget, gateCost(slot.kind, value))) continue;
    const prefix = slot.kind === 'multiply' ? 'x' : '+';
    gates.push({
      ...zoneAwarePoint(slot, template.gateZones, rng, 18, 18),
      w: 76,
      h: 24,
      label: `${prefix}${value}`,
      effect: effectFor(slot.kind, value),
    });
  }

  const platformCandidates = template.platformSlots
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

  const ramps: BoardRampDef[] = template.rampSlots.map((slot) => ({
    x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 14)),
    y: clamp(slot.y + jitter(rng, 14), SAFE_TOP_Y, SAFE_BOTTOM_Y),
    w: slot.w,
    h: 16,
    angle: clamp(slot.angle + jitter(rng, 4), template.rampAngles.min, template.rampAngles.max),
    label: slot.label,
    color: 0xd7f3ff,
  }));

  const boosters: BoardBoosterDef[] = [];
  for (const slot of template.boosterSlots) {
    if (!spendBudget(budget, BOOSTER_COST)) continue;
    boosters.push({
      ...zoneAwarePoint(slot, template.boosterPositions, rng, 16, 16),
      w: 106,
      h: 40,
      angle: slot.angle ?? 0,
      label: 'BOOST',
      effect: effectFor('add', clamp(2 + Math.floor(challenge / 2), 3, 8)),
      color: 0xff4fd8,
    });
  }

  const blockers: BoardBlockerDef[] = template.blockerSlots.map((slot) => ({
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

function buildBins(
  challenge: number,
  rng: Rng,
  budgetLimit: number,
  template: BoardTemplate,
): BinDef[] {
  const binW = GAME_WIDTH / BIN_COUNT;
  const baseJackpot = 8 + Math.floor(challenge / 2) + rng.intBetween(0, 2);
  const jackpot = clamp(baseJackpot * template.binDistribution.center, 8, 18);
  const shoulder = clamp((3 + Math.floor(challenge / 3)) * template.binDistribution.shoulder, 2, 8);
  const baseOuter = challenge >= 8 ? 0.5 : 1;
  const outer = clamp(baseOuter * template.binDistribution.outer, 0.5, 2);
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
    if (
      isRiskyJackpot &&
      remaining >= MYSTERY_COST &&
      challenge >= template.binDistribution.mysteryCenterFromChallenge
    ) {
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
  const templateId = pickTemplate(rng, difficulty, wave);
  const template = templateById(templateId);
  const budget = buildBoardBudget(difficulty, wave, chapter);
  const patternObjects = buildPatternObjects(template, rng, challenge, budget);

  return {
    id: `board_generated_${seed}_${difficulty}_${wave}_${chapter}_${template.id}`,
    width: GAME_WIDTH,
    height: BOARD_HEIGHT,
    gravity: 1,
    defaultRestitution: clamp(0.48 + challenge * 0.01, 0.5, 0.62),
    pegs: buildPegs(rng, challenge, template),
    ...patternObjects,
    bins: buildBins(challenge, rng, budget, template),
    maxConcurrentBalls: MAX_CONCURRENT_BALLS,
  };
}
