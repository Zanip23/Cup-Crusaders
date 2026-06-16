import Phaser from 'phaser';
import { COLORS } from '@/ui/layout';
import { getGsm } from '@/core/registry';
import { MetaOverlay } from '@/ui/MetaOverlay';

// Hauptmenü-Phase (docs/07): verwaltet nur den Lebenszyklus des DOM-Overlays.
export class MetaScene extends Phaser.Scene {
  private overlay?: MetaOverlay;

  constructor() {
    super('Meta');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgCss);
    this.overlay = new MetaOverlay(getGsm(this));
    this.overlay.mount();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.unmount();
      this.overlay = undefined;
    });
  }
}
