// Shop als HTML/CSS-DOM-Overlay über dem Canvas (docs/01/02/06).
// Kommuniziert mit dem Spiel NUR über den EventBus. A11y: echte Buttons,
// Focus-States, Touch-Ziele ≥48px (ADR-011).

import './styles/shop.css';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectCurrency } from '@/core/state/selectors';
import type { GameStateManager } from '@/core/state/GameStateManager';
import type { Rarity } from '@/types/content';
import type { UpgradeDef } from '@/content/upgrades';
import { scaledCost } from '@/systems/shop/ShopPool';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8c0d0',
  rare: '#4aa3ff',
  epic: '#b15cff',
  legendary: '#ff9f1a',
  mythic: '#ff4d6d',
};

interface CardEl {
  el: HTMLButtonElement;
  costEl: HTMLElement;
  card: UpgradeDef;
  cost: number;
}

export class ShopOverlay {
  private root?: HTMLDivElement;
  private header?: HTMLElement;
  private readonly cardEls: CardEl[] = [];
  private readonly bought = new Set<number>();
  private readonly onChange = (): void => this.refresh();

  constructor(
    private readonly gsm: GameStateManager,
    private readonly cards: UpgradeDef[],
    private readonly wave: number,
  ) {}

  mount(parent: HTMLElement = document.body): void {
    const root = document.createElement('div');
    root.className = 'cc-shop';
    root.setAttribute('data-testid', 'shop-overlay');

    this.header = document.createElement('div');
    this.header.className = 'cc-shop__header';
    root.appendChild(this.header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'cc-shop__cards';
    this.cards.forEach((card, i) => cardsWrap.appendChild(this.buildCard(card, i)));
    root.appendChild(cardsWrap);

    const next = document.createElement('button');
    next.className = 'cc-shop__next';
    next.textContent = 'Nächste Welle ▶';
    next.setAttribute('data-testid', 'shop-next');
    next.addEventListener('click', () => eventBus.emit(GameEvent.ShopComplete, {}));
    root.appendChild(next);

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

  private buildCard(card: UpgradeDef, index: number): HTMLButtonElement {
    const cost = scaledCost(card, this.wave);
    const el = document.createElement('button');
    el.className = 'cc-card';
    el.style.setProperty('--rarity', RARITY_COLOR[card.rarity]);
    el.setAttribute('data-testid', `shop-card-${index}`);
    el.innerHTML = `
      <div class="cc-card__icon">${card.icon}</div>
      <div class="cc-card__name">${card.name}</div>
      <div class="cc-card__desc">${card.description}</div>
      <div class="cc-card__cost">${cost} 🏐</div>`;
    el.addEventListener('click', () => this.tryBuy(index));
    const costEl = el.querySelector('.cc-card__cost') as HTMLElement;
    this.cardEls.push({ el, costEl, card, cost });
    return el;
  }

  private tryBuy(index: number): void {
    if (this.bought.has(index)) return;
    const entry = this.cardEls[index];
    if (selectCurrency(this.gsm.getState()) < entry.cost) return;
    this.bought.add(index);
    eventBus.emit(GameEvent.ShopBuy, { upgradeId: entry.card.id, cost: entry.cost });
    // StateChanged → refresh markiert die Karte als gekauft.
  }

  private refresh(): void {
    const currency = selectCurrency(this.gsm.getState());
    if (this.header) this.header.textContent = `💰 ${currency} Bälle`;
    for (let i = 0; i < this.cardEls.length; i++) {
      const { el, card, cost } = this.cardEls[i];
      const isBought = this.bought.has(i);
      const unaffordable = !isBought && currency < cost;
      el.classList.toggle('is-bought', isBought);
      el.classList.toggle('is-unaffordable', unaffordable);
      el.disabled = isBought;
      el.setAttribute('aria-label', `${card.name}, ${cost} Bälle${isBought ? ', gekauft' : ''}`);
    }
  }
}
