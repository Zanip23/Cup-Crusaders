import Phaser from 'phaser';
import { CENTER_X, CENTER_Y, COLORS } from '@/ui/layout';
import { getCoordinator } from '@/core/registry';

// Boot: lädt (in M1 keine Assets), initialisiert/lädt State (in main.ts erledigt)
// und routet in den Loop — Resume an der gespeicherten Phase oder neuer Run.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgCss);
    this.add
      .text(CENTER_X, CENTER_Y - 40, 'CUP CRUSADERS', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(CENTER_X, CENTER_Y + 20, 'M1 — leerer Loop', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    // Kurzer Beat, damit der Titel sichtbar ist, dann in den Loop.
    this.time.delayedCall(500, () => getCoordinator(this).resumeOrStart());
  }
}
