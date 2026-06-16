import Phaser from 'phaser';
import { COLORS } from '@/ui/layout';
import { getGsm } from '@/core/registry';
import { Rng } from '@/core/rng/Rng';
import { UPGRADES } from '@/content/upgrades';
import { availableUpgrades, drawCards } from '@/systems/shop/ShopPool';
import { ShopOverlay } from '@/ui/ShopOverlay';

// Shop-Phase: DOM-Overlay (docs/06). Die Szene zieht die Karten (seedbar) und
// verwaltet nur den Lebenszyklus des Overlays; Interaktion läuft über den EventBus.
export class ShopScene extends Phaser.Scene {
  private overlay?: ShopOverlay;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.shop);
    const gsm = getGsm(this);
    const { waveNumber, seed, upgrades } = gsm.getState().run;

    // 3 gewichtete Karten aus dem verfügbaren Pool (seedbar, docs/06).
    const rng = new Rng(seed + waveNumber * 7919);
    const pool = availableUpgrades(UPGRADES, upgrades);
    const cards = drawCards(pool, rng, 3);

    this.overlay = new ShopOverlay(gsm, cards, waveNumber);
    this.overlay.mount();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.unmount();
      this.overlay = undefined;
    });
  }
}
