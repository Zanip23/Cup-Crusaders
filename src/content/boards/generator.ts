// Datengetriebener Board-Generator für Pachinko-Layouts.
// Erzeugt deterministische Varianten aus Seed, Difficulty und Wave, hält Cup- und
// Funnel-Zonen frei und nutzt bewusste Zonen/Pattern statt komplettem Zufall.

import { Rng } from '@/core/rng/Rng';
import { createMysteryEffect, mysteryPoolIdForChallenge } from '@/content/boards/mysteryPools';
import { evaluateBoardPlayability } from '@/systems/drop/BoardPlayability';
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
const MAX_PLAYABILITY_ATTEMPTS = 8;

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
  { maxDifficulty: 5, multiplier: 5 },
  { maxDifficulty: 8, multiplier: 8 },
  { maxDifficulty: Number.POSITIVE_INFINITY, multiplier: 10 },
];

export type BoardTemplateId =
  | 'bar_cascade'
  | 'side_switch'
  | 'dense_multiplier_wall'
  | 'bonus_lane'
  | 'booster_lane'
  | 'split_multiplier_row'
  | 'bonus_split_row';

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

type SegmentKind = 'multiply' | 'mystery';
type SegmentColorRole = 'multiply' | 'bonus' | 'mystery';

interface SegmentRowDef {
  y: number;
  segments: SegmentDef[];
}

interface SegmentDef {
  xStart: number;
  width: number;
  kind: SegmentKind;
  valueRange: readonly [number, number];
  colorRole?: SegmentColorRole;
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
  platformSlots: Array<{ xRatio: number; y: number; w: number; labelKind: 'multiply' }>;
  gateSlots: Array<{ xRatio: number; y: number; kind: 'multiply' }>;
  boosterSlots: Array<{ xRatio: number; y: number; angle?: number }>;
  blockerSlots: Array<{ xRatio: number; y: number; angle: number; h: number }>;
  segmentRows?: SegmentRowDef[];
}

const NO_PEG_ZONES: BoardZone[] = [];
const NO_GATE_ZONES: BoardZone[] = [];
const FULL_BOOSTER_ZONE: BoardZone[] = [{ xMinRatio: 0.12, xMaxRatio: 0.88, yMin: 360, yMax: 880 }];

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'bar_cascade',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -20, max: 20 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.95, shoulder: 1.05, center: 1.15, mysteryCenterFromChallenge: 7 },
    riskRewardProfile: 'balanced',
    rampSlots: [
      { xRatio: 0.18, y: 425, angle: -16, w: 150, label: 'guide' },
      { xRatio: 0.82, y: 795, angle: 16, w: 150, label: 'guide' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 365, w: 520, labelKind: 'multiply' },
      { xRatio: 0.34, y: 520, w: 310, labelKind: 'multiply' },
      { xRatio: 0.72, y: 655, w: 230, labelKind: 'multiply' },
      { xRatio: 0.42, y: 790, w: 390, labelKind: 'multiply' },
      { xRatio: 0.68, y: 880, w: 250, labelKind: 'multiply' },
    ],
    gateSlots: [],
    boosterSlots: [],
    blockerSlots: [
      { xRatio: 0.24, y: 520, angle: 0, h: 155 },
      { xRatio: 0.55, y: 655, angle: 0, h: 150 },
      { xRatio: 0.78, y: 790, angle: 0, h: 165 },
    ],
  },
  {
    id: 'side_switch',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -24, max: 24 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 1.1, shoulder: 1.05, center: 0.95, mysteryCenterFromChallenge: 8 },
    riskRewardProfile: 'safe',
    rampSlots: [
      { xRatio: 0.18, y: 590, angle: -20, w: 170, label: 'switch' },
      { xRatio: 0.82, y: 735, angle: 20, w: 170, label: 'switch' },
    ],
    platformSlots: [
      { xRatio: 0.28, y: 370, w: 300, labelKind: 'multiply' },
      { xRatio: 0.72, y: 505, w: 300, labelKind: 'multiply' },
      { xRatio: 0.3, y: 650, w: 340, labelKind: 'multiply' },
      { xRatio: 0.72, y: 790, w: 360, labelKind: 'multiply' },
      { xRatio: 0.5, y: 880, w: 420, labelKind: 'multiply' },
    ],
    gateSlots: [],
    boosterSlots: [],
    blockerSlots: [
      { xRatio: 0.5, y: 505, angle: 0, h: 150 },
      { xRatio: 0.47, y: 650, angle: 0, h: 145 },
      { xRatio: 0.52, y: 790, angle: 0, h: 150 },
    ],
  },
  {
    id: 'dense_multiplier_wall',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -18, max: 18 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.65, shoulder: 1.05, center: 1.55, mysteryCenterFromChallenge: 5 },
    riskRewardProfile: 'highRisk',
    rampSlots: [
      { xRatio: 0.5, y: 455, angle: -14, w: 150, label: 'nudge' },
      { xRatio: 0.5, y: 845, angle: 14, w: 150, label: 'nudge' },
    ],
    platformSlots: [
      { xRatio: 0.29, y: 365, w: 260, labelKind: 'multiply' },
      { xRatio: 0.72, y: 365, w: 260, labelKind: 'multiply' },
      { xRatio: 0.5, y: 500, w: 500, labelKind: 'multiply' },
      { xRatio: 0.27, y: 640, w: 260, labelKind: 'multiply' },
      { xRatio: 0.73, y: 640, w: 260, labelKind: 'multiply' },
      { xRatio: 0.5, y: 780, w: 480, labelKind: 'multiply' },
      { xRatio: 0.5, y: 880, w: 300, labelKind: 'multiply' },
    ],
    gateSlots: [],
    boosterSlots: [],
    blockerSlots: [
      { xRatio: 0.18, y: 500, angle: 0, h: 160 },
      { xRatio: 0.38, y: 640, angle: 0, h: 165 },
      { xRatio: 0.62, y: 640, angle: 0, h: 165 },
      { xRatio: 0.82, y: 500, angle: 0, h: 160 },
    ],
  },
  {
    id: 'bonus_lane',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -22, max: 22 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.8, shoulder: 1.2, center: 1.35, mysteryCenterFromChallenge: 4 },
    riskRewardProfile: 'swingy',
    rampSlots: [
      { xRatio: 0.18, y: 500, angle: -18, w: 160, label: 'lane' },
      { xRatio: 0.82, y: 500, angle: 18, w: 160, label: 'lane' },
      { xRatio: 0.5, y: 850, angle: 0, w: 180, label: 'bonus' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 365, w: 360, labelKind: 'multiply' },
      { xRatio: 0.27, y: 515, w: 220, labelKind: 'multiply' },
      { xRatio: 0.73, y: 515, w: 220, labelKind: 'multiply' },
      { xRatio: 0.5, y: 675, w: 520, labelKind: 'multiply' },
      { xRatio: 0.32, y: 835, w: 260, labelKind: 'multiply' },
      { xRatio: 0.72, y: 835, w: 240, labelKind: 'multiply' },
    ],
    gateSlots: [],
    boosterSlots: [],
    blockerSlots: [
      { xRatio: 0.39, y: 515, angle: 0, h: 150 },
      { xRatio: 0.61, y: 515, angle: 0, h: 150 },
      { xRatio: 0.5, y: 835, angle: 0, h: 165 },
    ],
  },
  {
    id: 'booster_lane',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -26, max: 26 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.9, shoulder: 1.15, center: 1.2, mysteryCenterFromChallenge: 6 },
    riskRewardProfile: 'swingy',
    rampSlots: [
      { xRatio: 0.24, y: 440, angle: -22, w: 170, label: 'boost in' },
      { xRatio: 0.76, y: 760, angle: 22, w: 170, label: 'boost out' },
    ],
    platformSlots: [
      { xRatio: 0.5, y: 360, w: 500, labelKind: 'multiply' },
      { xRatio: 0.26, y: 505, w: 230, labelKind: 'multiply' },
      { xRatio: 0.74, y: 505, w: 230, labelKind: 'multiply' },
      { xRatio: 0.5, y: 660, w: 420, labelKind: 'multiply' },
      { xRatio: 0.28, y: 815, w: 260, labelKind: 'multiply' },
      { xRatio: 0.72, y: 880, w: 260, labelKind: 'multiply' },
    ],
    gateSlots: [],
    boosterSlots: [
      { xRatio: 0.5, y: 585, angle: 0 },
      { xRatio: 0.5, y: 745, angle: 0 },
    ],
    blockerSlots: [
      { xRatio: 0.38, y: 505, angle: 0, h: 150 },
      { xRatio: 0.62, y: 505, angle: 0, h: 150 },
      { xRatio: 0.5, y: 660, angle: 0, h: 170 },
    ],
  },
  {
    id: 'split_multiplier_row',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -18, max: 18 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.85, shoulder: 1.1, center: 1.3, mysteryCenterFromChallenge: 6 },
    riskRewardProfile: 'balanced',
    rampSlots: [
      { xRatio: 0.18, y: 500, angle: -16, w: 155, label: 'split' },
      { xRatio: 0.82, y: 760, angle: 16, w: 155, label: 'merge' },
    ],
    platformSlots: [{ xRatio: 0.5, y: 875, w: 420, labelKind: 'multiply' }],
    gateSlots: [],
    boosterSlots: [],
    blockerSlots: [],
    segmentRows: [
      {
        y: 390,
        segments: [
          { xStart: 56, width: 150, kind: 'multiply', valueRange: [3, 3] },
          { xStart: 238, width: 280, kind: 'multiply', valueRange: [5, 8], colorRole: 'bonus' },
          { xStart: 550, width: 140, kind: 'multiply', valueRange: [2, 2] },
        ],
      },
      {
        y: 645,
        segments: [
          { xStart: 82, width: 210, kind: 'multiply', valueRange: [2, 4], colorRole: 'multiply' },
          { xStart: 330, width: 160, kind: 'multiply', valueRange: [2, 3] },
          { xStart: 528, width: 170, kind: 'multiply', valueRange: [3, 5] },
        ],
      },
    ],
  },
  {
    id: 'bonus_split_row',
    pegZones: NO_PEG_ZONES,
    gateZones: NO_GATE_ZONES,
    rampAngles: { min: -22, max: 22 },
    boosterPositions: FULL_BOOSTER_ZONE,
    binDistribution: { outer: 0.75, shoulder: 1.2, center: 1.45, mysteryCenterFromChallenge: 4 },
    riskRewardProfile: 'swingy',
    rampSlots: [
      { xRatio: 0.2, y: 540, angle: -18, w: 160, label: 'bonus' },
      { xRatio: 0.8, y: 780, angle: 18, w: 160, label: 'bonus' },
    ],
    platformSlots: [{ xRatio: 0.5, y: 875, w: 390, labelKind: 'multiply' }],
    gateSlots: [],
    boosterSlots: [{ xRatio: 0.5, y: 720, angle: 0 }],
    blockerSlots: [],
    segmentRows: [
      {
        y: 400,
        segments: [
          { xStart: 58, width: 210, kind: 'multiply', valueRange: [2, 5], colorRole: 'multiply' },
          { xStart: 305, width: 140, kind: 'multiply', valueRange: [2, 2] },
          { xStart: 482, width: 210, kind: 'multiply', valueRange: [2, 5], colorRole: 'multiply' },
        ],
      },
      {
        y: 620,
        segments: [
          { xStart: 76, width: 175, kind: 'multiply', valueRange: [2, 3] },
          { xStart: 288, width: 175, kind: 'mystery', valueRange: [0, 0], colorRole: 'mystery' },
          { xStart: 500, width: 175, kind: 'multiply', valueRange: [2, 3] },
        ],
      },
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

export interface BoardGenerationOptions {
  allowedTemplates?: readonly BoardTemplateId[];
  allowMystery?: boolean;
  allowBoosters?: boolean;
  budgetBonus?: number;
  idSuffix?: string;
}

export function pickTemplate(
  rng: Rng,
  difficulty: number,
  wave: number,
  allowedTemplates?: readonly BoardTemplateId[],
): BoardTemplateId {
  const challenge = scaledDifficulty(difficulty, wave);
  const templates = allowedTemplates?.length
    ? BOARD_TEMPLATES.filter((template) => allowedTemplates.includes(template.id))
    : BOARD_TEMPLATES;
  return rng.weightedPick(templates, (template) => {
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
  if (template.pegZones.length === 0) return [];

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

function effectValue(_kind: 'multiply', challenge: number, rng: Rng, riskScore = 0): number {
  const maxMultiplier = maxMultiplierForDifficulty(challenge);
  const isEarlyOrSafe = challenge <= 3 || riskScore <= 2.5;
  const riskTier = clamp(Math.floor((riskScore - 2.5) / 1.4), 0, 4);
  const challengeTier = Math.floor((challenge - 1) / 3);

  if (isEarlyOrSafe) {
    return clamp(
      2 + (challenge >= 5 && rng.next() < 0.35 ? 1 : 0),
      2,
      Math.min(3, maxMultiplier),
    );
  }

  const visibilityBonus = rng.weightedPick([0, 1, 2, 3], (bonus) =>
    bonus === 0 ? 2 : bonus === 1 ? 5 : bonus === 2 ? 4 : 2,
  );
  const value = 2 + challengeTier + riskTier + visibilityBonus;

  return clamp(value, 2, maxMultiplier);
}

function effectFor(kind: 'multiply' | 'add', value: number) {
  return kind === 'multiply'
    ? { type: 'gateMultiply' as const, params: { factor: value } }
    : { type: 'gateAdd' as const, params: { amount: value } };
}

function mysteryEffectFor(challenge: number) {
  return createMysteryEffect(mysteryPoolIdForChallenge(challenge));
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
  const sideRisk = Math.min(1, Math.abs(slot.xRatio - 0.5) / 0.5);
  const depthRisk = clamp((slot.y - SAFE_TOP_Y) / (SAFE_BOTTOM_Y - SAFE_TOP_Y), 0, 1);
  const narrowRisk = slot.w ? clamp((260 - slot.w) / 140, 0, 1) : 0.45;
  const wideSafety = slot.w ? clamp((slot.w - 360) / 160, 0, 1) : 0;
  return sideRisk * 3 + depthRisk * 2 + narrowRisk * 2 + blockerCount * 0.5 - wideSafety * 2;
}

function gateCost(_kind: 'multiply', value: number): number {
  return GATE_COSTS.multiply + (value - 2) * GATE_COSTS.multiplierStep;
}

function platformCost(_kind: 'multiply', value: number, width: number): number {
  const base = PLATFORM_COSTS.multiply + (value - 2) * PLATFORM_COSTS.multiplierStep;
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

function segmentColor(colorRole: SegmentColorRole | undefined, kind: SegmentKind): number {
  const role = colorRole ?? kind;
  if (role === 'bonus') return 0x20b457;
  if (role === 'mystery') return 0x7b4ee6;
  return 0xf2a91c;
}

function segmentValue(segment: SegmentDef, rng: Rng, challenge: number): number {
  const [min, max] = segment.valueRange;
  const cappedMax = Math.min(max, maxMultiplierForDifficulty(challenge));
  return rng.intBetween(Math.min(min, cappedMax), Math.max(min, cappedMax));
}

function segmentLabel(kind: SegmentKind, value: number): string {
  if (kind === 'mystery') return '???';
  return `X${value}`;
}

function segmentEffect(kind: SegmentKind, value: number, challenge: number) {
  if (kind === 'mystery') return mysteryEffectFor(challenge);
  return effectFor(kind, value);
}

function segmentCost(segment: SegmentDef, value: number): number {
  if (segment.kind === 'mystery') return MYSTERY_COST;
  return platformCost(segment.kind, value, segment.width);
}

function buildSegmentRow(
  y: number,
  segments: SegmentDef[],
  rng: Rng,
  challenge: number,
  budget?: { remaining: number },
): { platforms: BoardPlatformDef[]; blockers: BoardBlockerDef[] } {
  const edgePadding = 44;
  const platforms: BoardPlatformDef[] = [];
  const blockers: BoardBlockerDef[] = [];
  const orderedSegments = [...segments].sort((a, b) => a.xStart - b.xStart);
  const rowY = clamp(y + jitter(rng, 8), SAFE_TOP_Y, SAFE_BOTTOM_Y);

  for (const segment of orderedSegments) {
    const value = segmentValue(segment, rng, challenge);
    if (budget && !spendBudget(budget, segmentCost(segment, value))) continue;

    const halfWidth = segment.width / 2;
    platforms.push({
      x: clamp(
        Math.round(segment.xStart + halfWidth + jitter(rng, 6)),
        edgePadding + halfWidth,
        GAME_WIDTH - edgePadding - halfWidth,
      ),
      y: rowY,
      w: segment.width,
      h: 44,
      angle: 0,
      label: segmentLabel(segment.kind, value),
      effect: segmentEffect(segment.kind, value, challenge),
      color: segmentColor(segment.colorRole, segment.kind),
    });
  }

  for (let index = 1; index < orderedSegments.length; index++) {
    const previous = orderedSegments[index - 1];
    const current = orderedSegments[index];
    const previousEnd = previous.xStart + previous.width;
    const boundaryX = Math.round((previousEnd + current.xStart) / 2 + jitter(rng, 4));

    blockers.push({
      x: clamp(boundaryX, edgePadding, GAME_WIDTH - edgePadding),
      y: clamp(rowY + 38, SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: 30,
      h: clamp(96 + challenge * 4 + jitter(rng, 10), 96, 148),
      angle: 0,
      color: 0xbf7134,
    });
  }

  return { platforms, blockers };
}

interface BoardObjectBounds {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

function rotatedBounds(
  object: { x: number; y: number; w: number; h: number; angle?: number },
  padding = 0,
): BoardObjectBounds {
  const angle = Math.abs(((object.angle ?? 0) * Math.PI) / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: object.x,
    y: object.y,
    halfW: (Math.abs(object.w * cos) + Math.abs(object.h * sin)) / 2 + padding,
    halfH: (Math.abs(object.w * sin) + Math.abs(object.h * cos)) / 2 + padding,
  };
}

function boundsOverlap(a: BoardObjectBounds, b: BoardObjectBounds): boolean {
  return Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH;
}

function overlapsBoardObject(
  a: { x: number; y: number; w: number; h: number; angle?: number },
  b: { x: number; y: number; w: number; h: number; angle?: number },
  padding = 10,
): boolean {
  return boundsOverlap(rotatedBounds(a, padding), rotatedBounds(b, padding));
}

function objectArea(object: { w: number; h: number }): number {
  return object.w * object.h;
}

function removeVisualCollisions(
  blockers: BoardBlockerDef[],
  platforms: BoardPlatformDef[],
  ramps: BoardRampDef[],
): { blockers: BoardBlockerDef[]; ramps: BoardRampDef[] } {
  const cleanRamps = ramps.filter(
    (ramp) => !platforms.some((platform) => overlapsBoardObject(ramp, platform, 14)),
  );
  const cleanBlockers: BoardBlockerDef[] = [];

  for (const blocker of blockers) {
    const touchesPlatform = platforms.some((platform) =>
      overlapsBoardObject(blocker, platform, 12),
    );
    const touchesRamp = cleanRamps.some((ramp) => overlapsBoardObject(blocker, ramp, 10));
    const touchesBlocker = cleanBlockers.some((existing) =>
      overlapsBoardObject(blocker, existing, 8),
    );
    if (!touchesPlatform && !touchesRamp && !touchesBlocker) cleanBlockers.push(blocker);
  }

  const finalRamps = cleanRamps.filter(
    (ramp) => !cleanBlockers.some((blocker) => overlapsBoardObject(ramp, blocker, 10)),
  );
  const sortedRamps = finalRamps.sort((a, b) => objectArea(b) - objectArea(a));
  const nonOverlappingRamps: BoardRampDef[] = [];
  for (const ramp of sortedRamps) {
    if (!nonOverlappingRamps.some((existing) => overlapsBoardObject(ramp, existing, 8))) {
      nonOverlappingRamps.push(ramp);
    }
  }

  return { blockers: cleanBlockers, ramps: nonOverlappingRamps };
}

function fixWallAngle(xRatio: number, angle: number): number {
  if (xRatio < 0.5 && angle < 0) return Math.abs(angle);
  if (xRatio > 0.5 && angle > 0) return -Math.abs(angle);
  return angle;
}

function buildPatternObjects(
  template: BoardTemplate,
  rng: Rng,
  challenge: number,
  budgetLimit: number,
  options: BoardGenerationOptions = {},
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
    const prefix = slot.kind === 'multiply' ? 'X' : 'Bonus';
    const useMystery =
      options.allowMystery !== false && challenge >= 4 && riskScore >= 4.5 && rng.next() < 0.28;
    gates.push({
      ...zoneAwarePoint(slot, template.gateZones, rng, 18, 18),
      w: 96,
      h: 44,
      label: useMystery ? '???' : slot.kind === 'multiply' ? `${prefix}${value}` : prefix,
      effect: useMystery ? mysteryEffectFor(challenge) : effectFor(slot.kind, value),
      color: useMystery ? 0x7b4ee6 : undefined,
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
    const prefix = slot.labelKind === 'multiply' ? 'X' : 'Bonus';
    const useMystery =
      options.allowMystery !== false && challenge >= 5 && riskScore >= 4 && rng.next() < 0.22;
    platforms.push({
      x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 20)),
      y: clamp(slot.y + jitter(rng, 16), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: slot.w,
      h: 44,
      angle: 0,
      label: useMystery ? '???' : slot.labelKind === 'multiply' ? `${prefix}${value}` : prefix,
      effect: useMystery ? mysteryEffectFor(challenge) : effectFor(slot.labelKind, value),
      color: useMystery ? 0x7b4ee6 : slot.labelKind === 'multiply' ? 0xf2a91c : 0x20b457,
    });
  }

  const segmentBlockers: BoardBlockerDef[] = [];
  for (const row of template.segmentRows ?? []) {
    const segmentObjects = buildSegmentRow(row.y, row.segments, rng, challenge, budget);
    platforms.push(...segmentObjects.platforms);
    segmentBlockers.push(...segmentObjects.blockers);
  }

  const rampAnchorBlockers: BoardBlockerDef[] = [];
  const ramps: BoardRampDef[] = template.rampSlots.map((slot) => {
    const rawAngle = clamp(
      slot.angle + jitter(rng, 4),
      template.rampAngles.min,
      template.rampAngles.max,
    );
    const angle = fixWallAngle(slot.xRatio, rawAngle);
    const x = Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 14));
    const y = clamp(slot.y + jitter(rng, 14), SAFE_TOP_Y, SAFE_BOTTOM_Y);
    const angleRad = (angle * Math.PI) / 180;
    const highEndDirection = Math.sin(angleRad) >= 0 ? -1 : 1;
    const anchorX = x + Math.cos(angleRad) * (slot.w / 2) * highEndDirection;
    const anchorY = y + Math.sin(angleRad) * (slot.w / 2) * highEndDirection;
    rampAnchorBlockers.push({
      x: clamp(Math.round(anchorX), 40, GAME_WIDTH - 40),
      y: clamp(Math.round(anchorY - 42), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: 30,
      h: 104,
      angle: 0,
      color: 0xbf7134,
    });

    return {
      x,
      y,
      w: slot.w,
      h: 30,
      angle,
      color: 0xbf7134,
    };
  });

  const boosters: BoardBoosterDef[] = [];
  for (const slot of options.allowBoosters === false ? [] : template.boosterSlots) {
    if (!spendBudget(budget, BOOSTER_COST)) continue;
    boosters.push({
      ...zoneAwarePoint(slot, template.boosterPositions, rng, 16, 16),
      w: 126,
      h: 44,
      angle: slot.angle ?? 0,
      label: 'BOOST',
      effect: effectFor('add', clamp(2 + Math.floor(challenge / 2), 3, 8)),
      color: 0x18aeea,
    });
  }

  const blockers: BoardBlockerDef[] = template.blockerSlots.map((slot) => ({
    x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 10)),
    y: clamp(slot.y + jitter(rng, 10), SAFE_TOP_Y, SAFE_BOTTOM_Y),
    w: 30,
    h: slot.h,
    angle: fixWallAngle(slot.xRatio, slot.angle ?? 0),
    color: 0xbf7134,
  }));
  blockers.push(...segmentBlockers, ...rampAnchorBlockers);
  const cleanObjects = removeVisualCollisions(blockers, platforms, ramps);

  return { gates, platforms, ramps: cleanObjects.ramps, boosters, blockers: cleanObjects.blockers };
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
function buildGeneratedBoard(
  seed: number,
  difficulty: number,
  wave: number,
  chapter: number,
  options: BoardGenerationOptions = {},
): BoardDef {
  const rng = new Rng(
    (seed ^ Math.imul(difficulty, 0x45d9f3b) ^ Math.imul(wave, 0x119de1f3)) >>> 0,
  );
  const challenge = scaledDifficulty(difficulty, wave);
  const templateId = pickTemplate(rng, difficulty, wave, options.allowedTemplates);
  const template = templateById(templateId);
  const budget = buildBoardBudget(difficulty, wave, chapter) + (options.budgetBonus ?? 0);
  const patternObjects = buildPatternObjects(template, rng, challenge, budget, options);

  return {
    id: `board_generated_${seed}_${difficulty}_${wave}_${chapter}_${template.id}${options.idSuffix ? `_${options.idSuffix}` : ''}`,
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

function retrySeed(seed: number, attempt: number): number {
  return (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
}

export function generateBoard(
  seed: number,
  difficulty: number,
  wave: number,
  chapter = 1,
  options: BoardGenerationOptions = {},
): BoardDef {
  let fallback = buildGeneratedBoard(seed, difficulty, wave, chapter, options);

  for (let attempt = 0; attempt < MAX_PLAYABILITY_ATTEMPTS; attempt++) {
    const attemptSeed = retrySeed(seed, attempt);
    const board =
      attempt === 0
        ? fallback
        : buildGeneratedBoard(attemptSeed, difficulty, wave, chapter, options);
    const report = evaluateBoardPlayability(board, attemptSeed);

    if (report.passed) return board;
    fallback = board;
  }

  return fallback;
}
