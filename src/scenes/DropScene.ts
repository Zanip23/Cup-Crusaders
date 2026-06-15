import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import { createButton } from '@/ui/PlaceholderButton';
import { TopBar } from '@/ui/TopBar';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectBallsFromCombat } from '@/core/state/selectors';

// Drop-Phase (M1: Platzhalter). Echte Matter.js-Pachinko-Physik kommt in M3.
// Liest die Munition (ballsFromCombat) und liefert eine Test-Summe an den Shop.
export class DropScene extends Phaser.Scene {
  constructor() {
    super('Drop');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.drop);
    const gsm = getGsm(this);
    const ammo = selectBallsFromCombat(gsm.getState());

    new TopBar(this, 'DROP (Pachinko)', (g) => `Munition: ${selectBallsFromCombat(g.getState())}`);

    // Platzhalter-Peg-Feld.
    for (let row = 0; row < 6; row++) {
      const cols = row % 2 === 0 ? 6 : 5;
      const offset = row % 2 === 0 ? 0 : 60;
      for (let c = 0; c < cols; c++) {
        this.add.circle(110 + offset + c * 100, 220 + row * 90, 8, 0xffffff, 0.6);
      }
    }

    // Platzhalter-Bins.
    const binMults = [1, 5, 10, 5, 1];
    const binW = GAME_WIDTH / binMults.length;
    binMults.forEach((m, i) => {
      this.add
        .rectangle(binW * i + binW / 2, GAME_HEIGHT - 300, binW - 8, 70, COLORS.shop)
        .setStrokeStyle(2, 0xffffff, 0.4);
      this.add
        .text(binW * i + binW / 2, GAME_HEIGHT - 300, `x${m}`, {
          fontSize: '24px',
          color: m >= 10 ? '#f4c430' : COLORS.text,
        })
        .setOrigin(0.5);
    });

    // Platzhalter-Auszahlung: grobe Annäherung an einen echten Drop-Lauf.
    // (In M3 ersetzt durch DropResolver über echte Matter-Ergebnisse, ADR-009.)
    const result = Math.round(ammo * 2.4);

    createButton(
      this,
      CENTER_X,
      GAME_HEIGHT - 180,
      `Bälle fallen lassen  (→ ${result})`,
      () => eventBus.emit(GameEvent.DropComplete, { balls: result }),
      { fill: COLORS.accent, width: 460 },
    );

    this.add
      .text(CENTER_X, GAME_HEIGHT - 100, 'Becher-Steuerung (Drag + Tap) — M3', {
        fontSize: '16px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }
}
