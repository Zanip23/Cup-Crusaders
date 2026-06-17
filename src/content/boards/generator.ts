// Datengetriebener Board-Generator für Pachinko-Layouts.
// Erzeugt deterministische Varianten aus Seed, Difficulty und Wave, hält Cup- und
// Funnel-Zonen frei und nutzt EIN flexibles Template (BOARD_TEMPLATE) als alleinige
// Quelle dafür, wie ein Board aussehen kann.

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
const BOOSTER_SEGMENT_COLOR = 0x2f80ff;
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

// Struktur-Modi sind die "Persönlichkeiten", die der Generator aus dem einen
// Template ableitet: ruhige Kaskade, Links/Rechts-Split, dichte Wand oder
// Segment-Reihen mit nebeneinander liegenden Multiplikatoren.
export type BoardStructureMode = 'cascade' | 'split' | 'wall' | 'segments';

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

// Konkretes, aus dem flexiblen Template aufgelöstes Layout. Genau diese Form
// konsumieren die Platzier-Funktionen (Plattformen, Rampen, Blocker, Bins).
interface ResolvedBoard {
  pegZones: BoardZone[];
  gateZones: BoardZone[];
  rampAngles: { min: number; max: number };
  binDistribution: BinDistribution;

  rampSlots: Array<{ xRatio: number; y: number; angle: number; w: number; label: string }>;
  platformSlots: Array<{ xRatio: number; y: number; w: number; labelKind: 'multiply' }>;
  gateSlots: Array<{ xRatio: number; y: number; kind: 'multiply' }>;
  boosterSlots: Array<{ xRatio: number; y: number; angle?: number }>;
  blockerSlots: Array<{ xRatio: number; y: number; angle: number; h: number }>;
  segmentRows?: SegmentRowDef[];
}

const NO_ZONES: BoardZone[] = [];

// ── Das EINE Board-Template ────────────────────────────────────────────────
// Hier ist vollständig definiert, wie ein Board aussehen *kann*. Statt vieler
// fest gebauter Templates beschreibt dieses Objekt den gesamten Möglichkeits-
// raum als Bandbreiten/Optionen. Der Generator löst daraus seed-gesteuert ein
// konkretes Layout auf (resolveBoard): zuerst Risiko-Profil + Struktur-Modus,
// dann konkrete Reihen-, Plattform-, Rampen-, Blocker- und Booster-Positionen.
// Gleiche (Seed, Welle, Difficulty) ⇒ exakt gleiches Board; andere Seeds ⇒
// sichtbar andere Boards.
interface FlexibleBoardConfig {
  /** Vertikaler Bereich + Anzahl der Plattform-Reihen (Wand-Modus dichter). */
  rows: {
    top: number;
    bottom: number;
    countRange: [number, number];
    wallCountRange: [number, number];
  };
  /** Plattform-Breiten je Rolle. */
  platformWidth: {
    wide: [number, number];
    medium: [number, number];
    split: [number, number];
  };
  /** Leit-Rampen: Anzahl, Winkel- und Breitenbereich. */
  ramps: {
    countRange: [number, number];
    angleRange: [number, number];
    widthRange: [number, number];
  };
  /** Beschleuniger-Felder: Wahrscheinlichkeit pro Board + Maximalzahl. */
  boosters: { chance: number; maxCount: number };
  /** Chance, dass eine Reihe als Segment-Reihe (nebeneinander liegende
   *  Multiplikatoren) statt als einzelne Plattform erscheint. */
  segments: { rowChance: number; strayChance: number };
  /** Holz-Blocker-Höhenbereich. */
  blockers: { heightRange: [number, number] };
  /** Risiko-Profile und ihre Gewichtung in Abhängigkeit der Challenge. */
  riskProfiles: readonly RiskRewardProfile[];
  /** Struktur-Modi und ihre Gewichtung je Risiko-Profil. */
  structureModes: readonly BoardStructureMode[];
}

const BOARD_TEMPLATE: FlexibleBoardConfig = {
  rows: { top: 360, bottom: 890, countRange: [4, 6], wallCountRange: [6, 7] },
  platformWidth: { wide: [360, 520], medium: [220, 340], split: [200, 280] },
  ramps: { countRange: [1, 3], angleRange: [14, 26], widthRange: [150, 175] },
  boosters: { chance: 0.45, maxCount: 2 },
  segments: { rowChance: 0.5, strayChance: 0.12 },
  blockers: { heightRange: [145, 170] },
  riskProfiles: ['safe', 'balanced', 'swingy', 'highRisk'],
  structureModes: ['cascade', 'split', 'wall', 'segments'],
};

// Bin-Verteilung (Außen-/Schulter-/Mitte-Gewichte + Mystery-Schwelle) folgt dem
// gewürfelten Risiko-Profil: safe = flach/sicher, highRisk = extreme Mitte.
const BIN_DISTRIBUTION_BY_RISK: Record<RiskRewardProfile, BinDistribution> = {
  safe: { outer: 1.1, shoulder: 1.05, center: 0.95, mysteryCenterFromChallenge: 8 },
  balanced: { outer: 0.95, shoulder: 1.05, center: 1.15, mysteryCenterFromChallenge: 7 },
  swingy: { outer: 0.85, shoulder: 1.15, center: 1.3, mysteryCenterFromChallenge: 5 },
  highRisk: { outer: 0.65, shoulder: 1.05, center: 1.55, mysteryCenterFromChallenge: 4 },
};

const STRUCTURE_MODE_WEIGHTS: Record<RiskRewardProfile, Record<BoardStructureMode, number>> = {
  safe: { cascade: 5, split: 4, segments: 2, wall: 1 },
  balanced: { cascade: 4, split: 4, segments: 3, wall: 2 },
  swingy: { cascade: 2, split: 3, segments: 4, wall: 3 },
  highRisk: { cascade: 1, split: 2, segments: 3, wall: 5 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jitter(rng: Rng, amount: number): number {
  return rng.intBetween(-amount, amount);
}

function scaledDifficulty(difficulty: number, wave: number): number {
  return clamp(Math.round(difficulty + wave * 0.35), 1, 12);
}

function rangeInt(rng: Rng, [min, max]: [number, number]): number {
  return rng.intBetween(min, max);
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
  allowMystery?: boolean;
  allowBoosters?: boolean;
  budgetBonus?: number;
  idSuffix?: string;
}

// ── Template-Auflösung (seed-gesteuert) ─────────────────────────────────────

/** Risiko-Profil seed-gesteuert ziehen — bei niedriger Challenge ruhiger. */
function pickRiskProfile(rng: Rng, challenge: number): RiskRewardProfile {
  return rng.weightedPick([...BOARD_TEMPLATE.riskProfiles], (profile) =>
    profile === 'safe'
      ? clamp(8 - challenge, 1, 7)
      : profile === 'balanced'
        ? 6
        : profile === 'swingy'
          ? clamp(3 + challenge * 0.45, 3, 8)
          : clamp(challenge - 1, 1, 9),
  );
}

/** Struktur-Modus seed-gesteuert ziehen, gewichtet nach Risiko-Profil. */
function pickStructureMode(rng: Rng, risk: RiskRewardProfile): BoardStructureMode {
  return rng.weightedPick(
    [...BOARD_TEMPLATE.structureModes],
    (mode) => STRUCTURE_MODE_WEIGHTS[risk][mode],
  );
}

/** Gleichmäßig verteilte Reihen-Y-Positionen für den gewählten Modus. */
function buildRowYs(rng: Rng, mode: BoardStructureMode): number[] {
  const { top, bottom, countRange, wallCountRange } = BOARD_TEMPLATE.rows;
  const count = rangeInt(rng, mode === 'wall' ? wallCountRange : countRange);
  const span = bottom - top;
  const ys: number[] = [];
  for (let i = 0; i < count; i++) {
    ys.push(Math.round(top + (span * i) / Math.max(1, count - 1)));
  }
  return ys;
}

/** Eine Segment-Reihe (nebeneinander liegende Multiplikatoren) würfeln. */
function buildSegmentRowDef(rng: Rng, y: number, allowMystery: boolean): SegmentRowDef {
  const count = rng.intBetween(2, 3);
  const edge = 56;
  const gap = 28;
  const usable = GAME_WIDTH - edge * 2 - gap * (count - 1);
  const baseW = Math.floor(usable / count);
  const segments: SegmentDef[] = [];
  let x = edge;
  for (let i = 0; i < count; i++) {
    const isCenter = count === 3 && i === 1;
    const width = clamp(baseW + jitter(rng, 26), 130, 300);
    const useMystery = allowMystery && isCenter && rng.next() < 0.35;
    const kind: SegmentKind = useMystery ? 'mystery' : 'multiply';
    const valueRange: readonly [number, number] = useMystery ? [0, 0] : isCenter ? [4, 8] : [2, 5];
    const colorRole: SegmentColorRole = useMystery ? 'mystery' : isCenter ? 'bonus' : 'multiply';
    segments.push({ xStart: Math.round(x), width, kind, valueRange, colorRole });
    x += width + gap;
  }
  return { y, segments };
}

/** Leit-Rampen seed-gesteuert platzieren (1–3, an wechselnden Seiten). */
function buildRampSlots(rng: Rng): ResolvedBoard['rampSlots'] {
  const count = rangeInt(rng, BOARD_TEMPLATE.ramps.countRange);
  const [angleMin, angleMax] = BOARD_TEMPLATE.ramps.angleRange;
  const slots: ResolvedBoard['rampSlots'] = [];
  for (let i = 0; i < count; i++) {
    const onLeft = i % 2 === 0;
    const angleMag = rng.intBetween(angleMin, angleMax);
    slots.push({
      xRatio: onLeft ? 0.18 + rng.next() * 0.08 : 0.74 + rng.next() * 0.08,
      y: clamp(440 + i * 150 + jitter(rng, 30), 400, 860),
      angle: onLeft ? -angleMag : angleMag,
      w: rangeInt(rng, BOARD_TEMPLATE.ramps.widthRange),
      label: 'guide',
    });
  }
  return slots;
}

/** Plattform-/Blocker-/Booster-/Segment-Slots für ein Reihen-Layout würfeln. */
function buildBoardLayout(
  rng: Rng,
  mode: BoardStructureMode,
  allowMystery: boolean,
): Pick<ResolvedBoard, 'platformSlots' | 'blockerSlots' | 'boosterSlots' | 'segmentRows'> {
  const platformSlots: ResolvedBoard['platformSlots'] = [];
  const blockerSlots: ResolvedBoard['blockerSlots'] = [];
  const boosterSlots: ResolvedBoard['boosterSlots'] = [];
  const segmentRows: SegmentRowDef[] = [];
  const rowYs = buildRowYs(rng, mode);
  const { wide, medium, split } = BOARD_TEMPLATE.platformWidth;
  const blockerHeight = BOARD_TEMPLATE.blockers.heightRange;
  let boosterBudget =
    rng.next() < BOARD_TEMPLATE.boosters.chance
      ? rng.intBetween(1, BOARD_TEMPLATE.boosters.maxCount)
      : 0;

  rowYs.forEach((y, index) => {
    // Bodennahe Fang-Plattform: immer eine breite, mittige Plattform unten.
    if (index === rowYs.length - 1) {
      platformSlots.push({ xRatio: 0.5, y, w: rangeInt(rng, wide), labelKind: 'multiply' });
      return;
    }

    // Segment-Reihe? Im segments-Modus oft, sonst nur vereinzelt.
    const segmentChance =
      mode === 'segments' ? BOARD_TEMPLATE.segments.rowChance : BOARD_TEMPLATE.segments.strayChance;
    if (rng.next() < segmentChance) {
      segmentRows.push(buildSegmentRowDef(rng, y, allowMystery));
      return;
    }

    if (mode === 'split' || (mode === 'wall' && index % 2 === 1)) {
      // Zwei Plattformen links/rechts, Mitte frei für Blocker oder Booster.
      // Hostet die Reihe einen Booster, werden die Plattformen schmaler und
      // weiter an den Rand gerückt, damit der mittige Booster nicht überlappt.
      const hostsBooster = boosterBudget > 0;
      const w = hostsBooster
        ? clamp(rangeInt(rng, split) - 60, 150, 200)
        : rangeInt(rng, split);
      const leftRatio = hostsBooster ? 0.2 + rng.next() * 0.03 : 0.27 + rng.next() * 0.04;
      const rightRatio = hostsBooster ? 0.77 + rng.next() * 0.03 : 0.69 + rng.next() * 0.04;
      platformSlots.push({ xRatio: leftRatio, y, w, labelKind: 'multiply' });
      platformSlots.push({ xRatio: rightRatio, y, w, labelKind: 'multiply' });
      if (hostsBooster) {
        boosterSlots.push({ xRatio: 0.5, y, angle: 0 });
        boosterBudget--;
      } else {
        blockerSlots.push({ xRatio: 0.5, y, angle: 0, h: rangeInt(rng, blockerHeight) });
      }
      return;
    }

    if (mode === 'wall') {
      // Dichte, breite Plattform mit zwei seitlichen Blockern.
      platformSlots.push({ xRatio: 0.5, y, w: rangeInt(rng, wide), labelKind: 'multiply' });
      blockerSlots.push({ xRatio: 0.18, y, angle: 0, h: rangeInt(rng, blockerHeight) });
      blockerSlots.push({ xRatio: 0.82, y, angle: 0, h: rangeInt(rng, blockerHeight) });
      return;
    }

    // cascade (default): erste Reihe breit, danach versetzte Einzel-Plattformen
    // mit einem Blocker auf der Gegenseite (zwischen den Reihen versetzt).
    if (index === 0 || rng.next() < 0.25) {
      platformSlots.push({ xRatio: 0.5, y, w: rangeInt(rng, wide), labelKind: 'multiply' });
      return;
    }
    const onLeft = index % 2 === 1;
    platformSlots.push({
      xRatio: onLeft ? 0.3 + rng.next() * 0.06 : 0.64 + rng.next() * 0.06,
      y,
      w: rangeInt(rng, medium),
      labelKind: 'multiply',
    });
    blockerSlots.push({
      xRatio: onLeft ? 0.74 : 0.26,
      y,
      angle: 0,
      h: rangeInt(rng, blockerHeight),
    });
  });

  return { platformSlots, blockerSlots, boosterSlots, segmentRows };
}

/** Löst das flexible Template seed-gesteuert zu einem konkreten Board auf. */
function resolveBoard(
  rng: Rng,
  challenge: number,
  options: BoardGenerationOptions,
): { template: ResolvedBoard; mode: BoardStructureMode } {
  const risk = pickRiskProfile(rng, challenge);
  const mode = pickStructureMode(rng, risk);
  const layout = buildBoardLayout(rng, mode, options.allowMystery !== false);
  const rampSlots = buildRampSlots(rng);
  const angleMax = BOARD_TEMPLATE.ramps.angleRange[1];

  return {
    mode,
    template: {
      pegZones: NO_ZONES,
      gateZones: NO_ZONES,
      rampAngles: { min: -angleMax, max: angleMax },
      binDistribution: BIN_DISTRIBUTION_BY_RISK[risk],
      rampSlots,
      gateSlots: [],
      ...layout,
    },
  };
}

function buildPegs(rng: Rng, challenge: number, template: ResolvedBoard): PegDef[] {
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
  template: ResolvedBoard,
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
  const platforms: BoardPlatformDef[] = [];
  for (const { slot, riskScore } of gateCandidates) {
    const value = effectValue(slot.kind, challenge, rng, riskScore);
    if (!spendBudget(budget, gateCost(slot.kind, value))) continue;
    const prefix = slot.kind === 'multiply' ? 'X' : 'Bonus';
    const useMystery =
      options.allowMystery !== false && challenge >= 5 && riskScore >= 5.25 && rng.next() < 0.08;
    const position = zoneAwarePoint(slot, template.gateZones, rng, 18, 18);

    if (useMystery) {
      platforms.push({
        x: position.x,
        y: position.y,
        w: 160,
        h: 26,
        angle: jitter(rng, 3),
        label: '???',
        effect: mysteryEffectFor(challenge),
        color: 0x9a5cff,
      });
      continue;
    }

    gates.push({
      ...position,
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
    const rowSlot = template.platformSlots.length
      ? template.platformSlots.reduce((nearest, candidate) =>
          Math.abs(candidate.y - slot.y) < Math.abs(nearest.y - slot.y) ? candidate : nearest,
        )
      : undefined;
    const width = rowSlot ? clamp(Math.round(rowSlot.w * 0.48), 150, 220) : 150;
    const rowY = rowSlot?.y ?? slot.y;
    boosters.push({
      x: Math.round(GAME_WIDTH * slot.xRatio + jitter(rng, 12)),
      y: clamp(rowY + jitter(rng, 8), SAFE_TOP_Y, SAFE_BOTTOM_Y),
      w: width,
      h: 34,
      angle: slot.angle ?? jitter(rng, 2),
      label: '▲ BOOST',
      effect: effectFor('add', clamp(2 + Math.floor(challenge / 2), 3, 8)),
      color: BOOSTER_SEGMENT_COLOR,
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
  template: ResolvedBoard,
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
  const { template, mode } = resolveBoard(rng, challenge, options);
  const budget = buildBoardBudget(difficulty, wave, chapter) + (options.budgetBonus ?? 0);
  const patternObjects = buildPatternObjects(template, rng, challenge, budget, options);

  return {
    id: `board_generated_${seed}_${difficulty}_${wave}_${chapter}_${mode}${options.idSuffix ? `_${options.idSuffix}` : ''}`,
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
