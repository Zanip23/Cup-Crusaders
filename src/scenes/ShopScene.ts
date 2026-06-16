import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, COLORS } from '@/ui/layout';
import { createButton } from '@/ui/PlaceholderButton';
import { TopBar } from '@/ui/TopBar';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectCurrency } from '@/core/state/selectors';

// Shop-Phase (M1: Platzhalter). Echte DOM-Overlay-Karten + Pool/Scaling in M4.
// Demonstriert mehrere Käufe pro Shop (ADR-003) und das Abziehen der Währung.
interface PlaceholderCard {
  id: string;
  name: string;
  cost: number;
}

export class ShopScene extends Phaser.Scene {
  private cards: PlaceholderCard[] = [];
  private cardObjects: Phaser.GameObjects.Container[] = [];
  private boughtIds = new Set<string>();
  private onChange = (): void => this.refreshCards();

  constructor() {
    super('Shop');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.shop);
    new TopBar(this, 'SHOP (Upgrades)', (g) => `Währung: ${selectCurrency(g.getState())}`);

    // Instanz-Status zuruecksetzen: Phaser verwendet Szenen-Instanzen ueber
    // scene.start() hinweg wieder, Klassenfelder werden NICHT neu initialisiert.
    this.boughtIds = new Set();
    this.cardObjects = [];

    // 3 statische Platzhalter-Karten (in M4 gewichtet aus dem Pool gezogen).
    this.cards = [
      { id: 'upg_multishot', name: 'Mehrfachschuss', cost: 40 },
      { id: 'upg_peg_density', name: 'Mehr Pegs', cost: 60 },
      { id: 'upg_max_hp', name: '+20 Max-HP', cost: 90 },
    ];

    const cardW = 200;
    const gap = 20;
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = CENTER_X - totalW / 2 + cardW / 2;
    const cardY = GAME_HEIGHT * 0.45;

    this.cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      const obj = this.buildCard(card, x, cardY, cardW);
      this.cardObjects.push(obj);
    });

    createButton(
      this,
      CENTER_X,
      GAME_HEIGHT - 150,
      'Nächste Welle ▶',
      () => eventBus.emit(GameEvent.ShopComplete, {}),
      { fill: COLORS.accent, width: 460 },
    );

    eventBus.on(GameEvent.StateChanged, this.onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      eventBus.off(GameEvent.StateChanged, this.onChange),
    );
    this.refreshCards();
  }

  private buildCard(card: PlaceholderCard, x: number, y: number, w: number): Phaser.GameObjects.Container {
    const h = 280;
    const bg = this.add.rectangle(0, 0, w, h, COLORS.combat).setStrokeStyle(3, 0xffffff, 0.8);
    const name = this.add
      .text(0, -90, card.name, {
        fontSize: '22px',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0.5);
    const cost = this.add
      .text(0, 90, `${card.cost} Bälle`, { fontSize: '24px', color: '#f4c430' })
      .setOrigin(0.5);
    const status = this.add.text(0, 40, '', { fontSize: '16px', color: COLORS.muted }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, name, cost, status]);
    container.setSize(w, h);
    container.setData('card', card);
    container.setData('bg', bg);
    container.setData('status', status);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerup', () => this.tryBuy(card));
    return container;
  }

  private tryBuy(card: PlaceholderCard): void {
    if (this.boughtIds.has(card.id)) return;
    const currency = selectCurrency(getGsm(this).getState());
    if (currency < card.cost) return;
    this.boughtIds.add(card.id);
    eventBus.emit(GameEvent.ShopBuy, { upgradeId: card.id, cost: card.cost });
  }

  private refreshCards(): void {
    const currency = selectCurrency(getGsm(this).getState());
    this.cardObjects.forEach((obj) => {
      const card = obj.getData('card') as PlaceholderCard;
      const bg = obj.getData('bg') as Phaser.GameObjects.Rectangle;
      const status = obj.getData('status') as Phaser.GameObjects.Text;
      const bought = this.boughtIds.has(card.id);
      const affordable = currency >= card.cost;
      if (bought) {
        bg.setFillStyle(0x2a6e2a);
        status.setText('✓ Gekauft');
      } else if (affordable) {
        bg.setFillStyle(COLORS.combat);
        status.setText('Tippen zum Kaufen');
      } else {
        bg.setFillStyle(0x2a2a3a);
        status.setText('Zu teuer');
      }
    });
  }
}
