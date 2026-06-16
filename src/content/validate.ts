// Content-Validierung (docs/10): prüft beim Dev-Start und in CI auf eindeutige
// IDs, referenzielle Integrität, Enum-Gültigkeit und Sanity-Ranges. Verhindert
// „stillen" kaputten Content bei wachsender Menge. Rein/testbar.

import { StatKey } from '@/core/stats/StatTypes';
import type { ModifierOp } from '@/core/stats/StatTypes';
import { RARITIES, type BoardDef, type EquipSlot } from '@/types/content';
import { ENEMY_REGISTRY } from '@/content/enemies';
import { LEVEL_REGISTRY } from '@/content/levels';
import { BOARD_REGISTRY } from '@/content/boards/basic';
import { ITEMS } from '@/content/items';
import { UPGRADES, type UpgradeCategory } from '@/content/upgrades';
import { META_SKILLS } from '@/content/metaSkills';
import { SCALING_REGISTRY } from '@/content/scaling';

const STAT_KEYS = new Set<string>(Object.values(StatKey));
const OPS = new Set<ModifierOp>(['flat', 'percentAdd', 'percentMult']);
const SLOTS = new Set<EquipSlot>(['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring']);
const CATEGORIES = new Set<UpgradeCategory>(['combat', 'pachinko', 'passive']);

const MIN_MAX_CONCURRENT_BALLS = 100;
const MAX_MAX_CONCURRENT_BALLS = 250;
const MIN_MULTIPLIER = 0;
const MAX_MULTIPLIER = 20;
const GEOMETRY_EPSILON = 0.001;

interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CircleLike {
  x: number;
  y: number;
  radius: number;
}

function hasFiniteNumbers(values: number[]): boolean {
  return values.every(Number.isFinite);
}

function isCircleWithinBoard(item: CircleLike, board: BoardDef): boolean {
  return (
    hasFiniteNumbers([item.x, item.y, item.radius]) &&
    item.radius > 0 &&
    item.x - item.radius >= 0 &&
    item.x + item.radius <= board.width &&
    item.y - item.radius >= 0 &&
    item.y + item.radius <= board.height
  );
}

function isRectWithinBoard(item: RectLike, board: BoardDef): boolean {
  return (
    hasFiniteNumbers([item.x, item.y, item.w, item.h]) &&
    item.w > 0 &&
    item.h > 0 &&
    item.x - item.w / 2 >= 0 &&
    item.x + item.w / 2 <= board.width &&
    item.y - item.h / 2 >= 0 &&
    item.y + item.h / 2 <= board.height
  );
}

function blockerFormsHorizontalBarrier(board: BoardDef): boolean {
  const spans = (board.blockers ?? [])
    .filter(
      (blocker) =>
        hasFiniteNumbers([blocker.x, blocker.y, blocker.w, blocker.h]) &&
        blocker.w > 0 &&
        blocker.h > 0,
    )
    .map((blocker) => ({
      minX: Math.max(0, blocker.x - blocker.w / 2),
      maxX: Math.min(board.width, blocker.x + blocker.w / 2),
      minY: blocker.y - blocker.h / 2,
      maxY: blocker.y + blocker.h / 2,
    }))
    .filter((span) => span.maxX > span.minX && span.maxY > span.minY);

  const sampleYs = [
    ...new Set(spans.flatMap((span) => [span.minY, span.maxY, (span.minY + span.maxY) / 2])),
  ];
  return sampleYs.some((y) => {
    const active = spans
      .filter((span) => span.minY <= y && y <= span.maxY)
      .map((span) => [span.minX, span.maxX] as const)
      .sort((a, b) => a[0] - b[0]);
    if (active.length === 0 || active[0][0] > GEOMETRY_EPSILON) return false;

    let coveredUntil = active[0][1];
    for (const [minX, maxX] of active.slice(1)) {
      if (minX > coveredUntil + GEOMETRY_EPSILON) return false;
      coveredUntil = Math.max(coveredUntil, maxX);
    }
    return coveredUntil >= board.width - GEOMETRY_EPSILON;
  });
}

/** Prüft die spielrelevante Board-Geometrie (leer = alles gültig). */
export function validateBoardGeometry(board: BoardDef): string[] {
  const errors: string[] = [];
  const err = (message: string) => errors.push(`Board '${board.id}': ${message}`);

  if (!hasFiniteNumbers([board.width, board.height]) || board.width <= 0 || board.height <= 0) {
    err('width/height müssen positiv sein');
    return errors;
  }

  board.pegs.forEach((peg, index) => {
    if (!isCircleWithinBoard(peg, board))
      err(`Peg ${index} liegt außerhalb des Boards oder hat keinen positiven Radius`);
  });
  board.bumpers?.forEach((bumper, index) => {
    if (!isCircleWithinBoard(bumper, board))
      err(`Bumper ${index} liegt außerhalb des Boards oder hat keinen positiven Radius`);
  });

  for (const [type, items] of [
    ['Gate', board.gates],
    ['Rampe', board.ramps ?? []],
    ['Plattform', board.platforms ?? []],
    ['Booster', board.boosters ?? []],
    ['Blocker', board.blockers ?? []],
  ] as const) {
    items.forEach((item, index) => {
      if (!isRectWithinBoard(item, board))
        err(`${type} ${index} liegt außerhalb des Boards oder hat keine positive Breite/Höhe`);
    });
  }

  if (board.bins.length === 0) {
    err('keine Bins');
  } else {
    const sortedBins = [...board.bins].sort((a, b) => a.x - b.x);
    let coveredUntil = 0;
    sortedBins.forEach((bin, index) => {
      if (!hasFiniteNumbers([bin.x, bin.w, bin.multiplier]))
        err(`Bin ${index} enthält nicht-finite Werte`);
      if (bin.w <= 0) err(`Bin ${index} hat keine positive Breite`);
      if (bin.x < 0 || bin.x + bin.w > board.width)
        err(`Bin ${index} liegt außerhalb der Board-Breite`);
      if (bin.multiplier < MIN_MULTIPLIER || bin.multiplier > MAX_MULTIPLIER)
        err(
          `Bin ${index} Multiplikator ${bin.multiplier} liegt außerhalb von ${MIN_MULTIPLIER} bis ${MAX_MULTIPLIER}`,
        );
      if (Math.abs(bin.x - coveredUntil) > GEOMETRY_EPSILON)
        err(`Bins haben eine Lücke/Überlappung bei x=${coveredUntil}`);
      coveredUntil = Math.max(coveredUntil, bin.x + bin.w);
    });
    if (Math.abs(coveredUntil - board.width) > GEOMETRY_EPSILON)
      err(`Bins decken die Board-Breite nicht vollständig ab (Ende bei x=${coveredUntil})`);
  }

  if (blockerFormsHorizontalBarrier(board))
    err('Blocker bilden eine vollständige horizontale Sperre');

  if (
    board.maxConcurrentBalls < MIN_MAX_CONCURRENT_BALLS ||
    board.maxConcurrentBalls > MAX_MAX_CONCURRENT_BALLS
  )
    err(
      `maxConcurrentBalls ${board.maxConcurrentBalls} liegt außerhalb des Performance-Korridors ${MIN_MAX_CONCURRENT_BALLS} bis ${MAX_MAX_CONCURRENT_BALLS}`,
    );

  return errors;
}

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

/** Liefert eine Liste von Validierungsfehlern (leer = alles gültig). */
export function validateContent(): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  // 1. Eindeutige IDs pro Typ.
  for (const [type, ids] of [
    ['enemy', Object.keys(ENEMY_REGISTRY)],
    ['level', Object.keys(LEVEL_REGISTRY)],
    ['board', Object.keys(BOARD_REGISTRY)],
    ['item', ITEMS.map((i) => i.id)],
    ['upgrade', UPGRADES.map((u) => u.id)],
    ['metaSkill', META_SKILLS.map((s) => s.id)],
  ] as const) {
    for (const d of dupes(ids)) err(`Doppelte ${type}-ID: '${d}'`);
  }

  // 2. Level: referenzielle Integrität + Sanity.
  for (const level of Object.values(LEVEL_REGISTRY)) {
    if (!BOARD_REGISTRY[level.boardId])
      err(`Level '${level.id}': unbekanntes boardId '${level.boardId}'`);
    if (!SCALING_REGISTRY[level.scalingProfileId])
      err(`Level '${level.id}': unbekanntes scalingProfileId '${level.scalingProfileId}'`);
    if (level.chapter < 1) err(`Level '${level.id}': chapter < 1`);
    if (level.waves.length === 0) err(`Level '${level.id}': keine Wellen`);
    for (const wave of level.waves) {
      if (wave.spawns.length === 0) err(`Welle '${wave.id}': keine Spawns`);
      for (const s of wave.spawns) {
        if (!ENEMY_REGISTRY[s.enemyId])
          err(`Welle '${wave.id}': unbekannte enemyId '${s.enemyId}'`);
        if (s.count <= 0) err(`Welle '${wave.id}': count <= 0`);
      }
    }
  }

  // 3. Gegner-Sanity.
  for (const e of Object.values(ENEMY_REGISTRY)) {
    if (e.baseStats.hp <= 0) err(`Gegner '${e.id}': hp <= 0`);
    if (e.baseStats.contactDamage < 0) err(`Gegner '${e.id}': contactDamage < 0`);
    if (e.ballDrop < 0) err(`Gegner '${e.id}': ballDrop < 0`);
  }

  // 4. Boards.
  for (const b of Object.values(BOARD_REGISTRY)) {
    for (const geometryError of validateBoardGeometry(b)) err(geometryError);
  }

  // 5. Upgrades: Enum/Sanity/Referenzen.
  const upgradeIds = new Set(UPGRADES.map((u) => u.id));
  for (const u of UPGRADES) {
    if (u.cost < 0) err(`Upgrade '${u.id}': cost < 0`);
    if (u.weight !== undefined && u.weight <= 0) err(`Upgrade '${u.id}': weight <= 0`);
    if (u.maxStacks !== undefined && u.maxStacks < 1) err(`Upgrade '${u.id}': maxStacks < 1`);
    if (!RARITIES.includes(u.rarity)) err(`Upgrade '${u.id}': unbekannte Rarität '${u.rarity}'`);
    if (!CATEGORIES.has(u.category)) err(`Upgrade '${u.id}': unbekannte Kategorie '${u.category}'`);
    for (const ref of [...(u.requires ?? []), ...(u.excludes ?? [])])
      if (!upgradeIds.has(ref)) err(`Upgrade '${u.id}': referenziert unbekanntes Upgrade '${ref}'`);
    for (const e of u.effects)
      if (e.type === 'addModifier') {
        if (!STAT_KEYS.has(String(e.params.stat)))
          err(`Upgrade '${u.id}': unbekannter StatKey '${String(e.params.stat)}'`);
        if (!OPS.has(e.params.op as ModifierOp))
          err(`Upgrade '${u.id}': unbekannter ModifierOp '${String(e.params.op)}'`);
      }
  }

  // 6. Items: Slot/Affix-Enum, Rarity-Vollständigkeit.
  for (const item of ITEMS) {
    if (!SLOTS.has(item.slot)) err(`Item '${item.id}': unbekannter Slot '${item.slot}'`);
    if (item.baseAffixes.length === 0) err(`Item '${item.id}': keine Affixe`);
    for (const a of item.baseAffixes) {
      if (!STAT_KEYS.has(String(a.stat)))
        err(`Item '${item.id}': unbekannter StatKey '${String(a.stat)}'`);
      if (!OPS.has(a.op)) err(`Item '${item.id}': unbekannter ModifierOp '${a.op}'`);
      for (const r of RARITIES)
        if (typeof a.valueByRarity[r] !== 'number')
          err(`Item '${item.id}': valueByRarity fehlt für '${r}'`);
    }
  }

  // 7. Meta-Skills.
  for (const s of META_SKILLS) {
    if (!STAT_KEYS.has(String(s.stat)))
      err(`Meta-Skill '${s.id}': unbekannter StatKey '${String(s.stat)}'`);
    if (!OPS.has(s.op)) err(`Meta-Skill '${s.id}': unbekannter ModifierOp '${s.op}'`);
    if (s.maxLevel < 1) err(`Meta-Skill '${s.id}': maxLevel < 1`);
    if (s.goldPerLevel < 0) err(`Meta-Skill '${s.id}': goldPerLevel < 0`);
  }

  return errors;
}
