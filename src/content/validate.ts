// Content-Validierung (docs/10): prüft beim Dev-Start und in CI auf eindeutige
// IDs, referenzielle Integrität, Enum-Gültigkeit und Sanity-Ranges. Verhindert
// „stillen" kaputten Content bei wachsender Menge. Rein/testbar.

import { StatKey } from '@/core/stats/StatTypes';
import type { ModifierOp } from '@/core/stats/StatTypes';
import { RARITIES, type EquipSlot } from '@/types/content';
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
    if (!BOARD_REGISTRY[level.boardId]) err(`Level '${level.id}': unbekanntes boardId '${level.boardId}'`);
    if (!SCALING_REGISTRY[level.scalingProfileId])
      err(`Level '${level.id}': unbekanntes scalingProfileId '${level.scalingProfileId}'`);
    if (level.chapter < 1) err(`Level '${level.id}': chapter < 1`);
    if (level.waves.length === 0) err(`Level '${level.id}': keine Wellen`);
    for (const wave of level.waves) {
      if (wave.spawns.length === 0) err(`Welle '${wave.id}': keine Spawns`);
      for (const s of wave.spawns) {
        if (!ENEMY_REGISTRY[s.enemyId]) err(`Welle '${wave.id}': unbekannte enemyId '${s.enemyId}'`);
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

  // 4. Boards. Catcher-Layout: Multiplikator-Balken (gates/platforms) + beweglicher
  // Fang-Becher (catcherWidth). Bins sind veraltet/optional.
  for (const b of Object.values(BOARD_REGISTRY)) {
    if (b.maxConcurrentBalls <= 0) err(`Board '${b.id}': maxConcurrentBalls <= 0`);
    if (b.gates.length === 0 && (b.platforms?.length ?? 0) === 0)
      err(`Board '${b.id}': keine Multiplikator-Balken (gates/platforms)`);
    if (b.catcherWidth !== undefined && b.catcherWidth <= 0)
      err(`Board '${b.id}': catcherWidth <= 0`);
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
        if (!STAT_KEYS.has(String(e.params.stat))) err(`Upgrade '${u.id}': unbekannter StatKey '${String(e.params.stat)}'`);
        if (!OPS.has(e.params.op as ModifierOp)) err(`Upgrade '${u.id}': unbekannter ModifierOp '${String(e.params.op)}'`);
      }
  }

  // 6. Items: Slot/Affix-Enum, Rarity-Vollständigkeit.
  for (const item of ITEMS) {
    if (!SLOTS.has(item.slot)) err(`Item '${item.id}': unbekannter Slot '${item.slot}'`);
    if (item.baseAffixes.length === 0) err(`Item '${item.id}': keine Affixe`);
    for (const a of item.baseAffixes) {
      if (!STAT_KEYS.has(String(a.stat))) err(`Item '${item.id}': unbekannter StatKey '${String(a.stat)}'`);
      if (!OPS.has(a.op)) err(`Item '${item.id}': unbekannter ModifierOp '${a.op}'`);
      for (const r of RARITIES)
        if (typeof a.valueByRarity[r] !== 'number') err(`Item '${item.id}': valueByRarity fehlt für '${r}'`);
    }
  }

  // 7. Meta-Skills.
  for (const s of META_SKILLS) {
    if (!STAT_KEYS.has(String(s.stat))) err(`Meta-Skill '${s.id}': unbekannter StatKey '${String(s.stat)}'`);
    if (!OPS.has(s.op)) err(`Meta-Skill '${s.id}': unbekannter ModifierOp '${s.op}'`);
    if (s.maxLevel < 1) err(`Meta-Skill '${s.id}': maxLevel < 1`);
    if (s.goldPerLevel < 0) err(`Meta-Skill '${s.id}': goldPerLevel < 0`);
  }

  return errors;
}
