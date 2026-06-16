import Phaser from 'phaser';
import { CENTER_X, CENTER_Y, COLORS } from '@/ui/layout';
import { getCoordinator } from '@/core/registry';
import { validateContent } from '@/content/validate';

// Boot: lädt Assets, initialisiert/lädt State (in main.ts erledigt), validiert den
// Content (Dev) und routet in den Loop — Resume an der gespeicherten Phase oder Menü.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bgCss);

    // Content-Validierung im Dev-Build (docs/10) — fehlerhafte Daten früh sichtbar.
    if (import.meta.env.DEV) {
      const errors = validateContent();
      if (errors.length) console.error('[validateContent] Fehler im Content:\n- ' + errors.join('\n- '));
    }
    this.add
      .text(CENTER_X, CENTER_Y - 40, 'CUP CRUSADERS', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(CENTER_X, CENTER_Y + 20, 'Auto-Battler · Pachinko · Roguelite', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    // Kurzer Beat, damit der Titel sichtbar ist, dann in den Loop.
    this.time.delayedCall(500, () => getCoordinator(this).resumeOrStart());
  }
}
