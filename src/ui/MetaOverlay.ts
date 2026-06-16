// Hauptmenü als HTML/CSS-DOM-Overlay (docs/07): Ausrüstung, Inventar, Merge,
// Item-Leveling, Meta-Skills, Run-Start. Phasenwechsel (Run-Start) über EventBus;
// reine Meta-Mutationen über gsm.dispatch (sanktionierte State-Schnittstelle).

import './styles/meta.css';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import type { GameStateManager } from '@/core/state/GameStateManager';
import type { EquipSlot, ItemInstance, Rarity } from '@/types/content';
import { ITEM_REGISTRY } from '@/content/items';
import { itemModifiers, levelUpCost, nextRarity } from '@/systems/meta/items';
import { findMergeGroups } from '@/systems/meta/merge';
import { META_SKILLS, META_SKILL_REGISTRY, metaSkillCost } from '@/content/metaSkills';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8c0d0',
  rare: '#4aa3ff',
  epic: '#b15cff',
  legendary: '#ff9f1a',
  mythic: '#ff4d6d',
};
const SLOTS: EquipSlot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring'];
const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: 'Waffe',
  helmet: 'Helm',
  armor: 'Rüstung',
  gloves: 'Hände',
  boots: 'Stiefel',
  ring: 'Ring',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class MetaOverlay {
  private root?: HTMLDivElement;
  private body?: HTMLDivElement;
  private cur?: HTMLDivElement;
  private readonly onChange = (): void => this.refresh();

  constructor(private readonly gsm: GameStateManager) {}

  mount(parent: HTMLElement = document.body): void {
    const root = el('div', 'cc-meta');
    root.setAttribute('data-testid', 'meta-overlay');
    root.appendChild(el('div', 'cc-meta__title', 'CUP CRUSADERS'));
    this.cur = el('div', 'cc-meta__cur');
    root.appendChild(this.cur);
    this.body = el('div', 'cc-meta__body');
    root.appendChild(this.body);

    const start = el('button', 'cc-meta__start', 'Run starten ▶');
    start.setAttribute('data-testid', 'meta-start-run');
    start.addEventListener('click', () => eventBus.emit(GameEvent.StartRun, { levelId: 'world_1' }));
    root.appendChild(start);

    parent.appendChild(root);
    this.root = root;
    eventBus.on(GameEvent.StateChanged, this.onChange);
    this.refresh();
  }

  unmount(): void {
    eventBus.off(GameEvent.StateChanged, this.onChange);
    this.root?.remove();
    this.root = undefined;
  }

  private refresh(): void {
    const { meta } = this.gsm.getState();
    if (this.cur) {
      this.cur.textContent = `💰 ${meta.currencies.gold}  📘 ${meta.currencies.blueprints}  🏆 Welle ${meta.highestLevel}`;
    }
    if (!this.body) return;
    this.body.replaceChildren();
    this.body.appendChild(el('h2', undefined, 'Ausrüstung'));
    this.body.appendChild(this.buildSlots(meta.equipped, meta.inventory));
    this.body.appendChild(el('h2', undefined, 'Inventar'));
    this.body.appendChild(this.buildInventory(meta));
    const merge = this.buildMerge(meta);
    if (merge) {
      this.body.appendChild(el('h2', undefined, 'Verschmelzen (3 → 1)'));
      this.body.appendChild(merge);
    }
    this.body.appendChild(el('h2', undefined, 'Meta-Fähigkeiten'));
    this.body.appendChild(this.buildSkills(meta.metaSkills, meta.currencies.gold));
  }

  private statSummary(inst: ItemInstance): string {
    return itemModifiers(inst)
      .map((m) => `+${m.value} ${m.stat}`)
      .join(', ');
  }

  private buildSlots(
    equipped: Partial<Record<EquipSlot, string | null>>,
    inventory: ItemInstance[],
  ): HTMLElement {
    const wrap = el('div', 'cc-slots');
    for (const slot of SLOTS) {
      const id = equipped[slot];
      const inst = id ? inventory.find((i) => i.instanceId === id) : undefined;
      const card = el('div', 'cc-slot');
      card.appendChild(el('div', 'cc-slot__label', SLOT_LABEL[slot]));
      if (inst) {
        const def = ITEM_REGISTRY[inst.baseId];
        card.style.setProperty('--rarity', RARITY_COLOR[inst.rarity]);
        card.appendChild(el('div', 'cc-slot__icon', def?.icon ?? '❔'));
        card.appendChild(el('div', undefined, `${def?.name} Lv${inst.level}`));
        const btn = el('button', 'cc-btn', 'Ablegen');
        btn.addEventListener('click', () => this.gsm.dispatch({ type: 'UNEQUIP_ITEM', slot }));
        card.appendChild(btn);
      } else {
        card.appendChild(el('div', 'cc-slot__icon', '—'));
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  private buildInventory(meta: ReturnType<GameStateManager['getState']>['meta']): HTMLElement {
    const wrap = el('div', 'cc-inv');
    const equippedIds = new Set(Object.values(meta.equipped).filter(Boolean));
    if (meta.inventory.length === 0) {
      wrap.appendChild(el('div', 'cc-empty', 'Noch keine Items — besiege den Boss für garantierte Beute.'));
      return wrap;
    }
    for (const inst of meta.inventory) {
      const def = ITEM_REGISTRY[inst.baseId];
      const card = el('div', 'cc-itemcard');
      card.style.setProperty('--rarity', RARITY_COLOR[inst.rarity]);
      card.setAttribute('data-testid', `meta-item-${inst.instanceId}`);
      card.appendChild(el('div', 'cc-itemcard__icon', def?.icon ?? '❔'));
      card.appendChild(el('div', undefined, `${def?.name ?? inst.baseId} Lv${inst.level}`));
      card.appendChild(el('div', 'cc-slot__label', this.statSummary(inst)));

      const row = el('div', 'cc-itemcard__row');
      const isEquipped = equippedIds.has(inst.instanceId);
      const equipBtn = el('button', isEquipped ? 'cc-btn cc-btn--equipped' : 'cc-btn cc-btn--equip', isEquipped ? 'Angelegt' : 'Anlegen');
      equipBtn.disabled = isEquipped;
      equipBtn.addEventListener('click', () => this.gsm.dispatch({ type: 'EQUIP_ITEM', instanceId: inst.instanceId }));
      row.appendChild(equipBtn);

      const cost = levelUpCost(inst.level);
      const lvlBtn = el('button', 'cc-btn', `⬆ ${cost.gold}💰${cost.blueprints ? `+${cost.blueprints}📘` : ''}`);
      lvlBtn.disabled =
        meta.currencies.gold < cost.gold || meta.currencies.blueprints < cost.blueprints;
      lvlBtn.addEventListener('click', () => this.gsm.dispatch({ type: 'LEVEL_ITEM', instanceId: inst.instanceId }));
      row.appendChild(lvlBtn);
      card.appendChild(row);
      wrap.appendChild(card);
    }
    return wrap;
  }

  private buildMerge(meta: ReturnType<GameStateManager['getState']>['meta']): HTMLElement | null {
    const equippedIds = new Set(Object.values(meta.equipped).filter((v): v is string => !!v));
    const groups = findMergeGroups(meta.inventory, equippedIds);
    if (groups.length === 0) return null;
    const wrap = el('div', 'cc-merge');
    groups.forEach((g, idx) => {
      const def = ITEM_REGISTRY[g.baseId];
      const nr = nextRarity(g.rarity);
      const btn = el('button', 'cc-btn', `3× ${def?.name} (${g.rarity}) → ${nr}`);
      btn.setAttribute('data-testid', `meta-merge-${idx}`);
      btn.addEventListener('click', () =>
        this.gsm.dispatch({ type: 'MERGE_ITEMS', instanceIds: g.instanceIds }),
      );
      wrap.appendChild(btn);
    });
    return wrap;
  }

  private buildSkills(levels: Record<string, number>, gold: number): HTMLElement {
    const wrap = el('div', 'cc-skills');
    for (const def of META_SKILLS) {
      const lvl = levels[def.id] ?? 0;
      const maxed = lvl >= def.maxLevel;
      const cost = metaSkillCost(META_SKILL_REGISTRY[def.id], lvl);
      const rowEl = el('div', 'cc-skillrow');
      const info = el('div', 'cc-skillrow__info');
      info.appendChild(el('div', undefined, `${def.icon} ${def.name}  (Lv ${lvl}/${def.maxLevel})`));
      info.appendChild(el('div', 'cc-slot__label', def.description));
      rowEl.appendChild(info);
      const btn = el('button', 'cc-btn', maxed ? 'MAX' : `${cost}💰`);
      btn.disabled = maxed || gold < cost;
      btn.setAttribute('data-testid', `meta-skill-${def.id}`);
      btn.addEventListener('click', () => this.gsm.dispatch({ type: 'BUY_META_SKILL', skillId: def.id }));
      rowEl.appendChild(btn);
      wrap.appendChild(rowEl);
    }
    return wrap;
  }
}
