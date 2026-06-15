import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import { createButton } from '@/ui/PlaceholderButton';
import { TopBar } from '@/ui/TopBar';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectIsBossWave, selectWave } from '@/core/state/selectors';

// Kampf-Phase (M1: Platzhalter). Echtes rundenbasiertes Auto-Battle kommt in M2.
// Liefert eine Test-Ballzahl über den transfer-Kanal an die Drop-Phase.
export class CombatScene extends Phaser.Scene {
  constructor() {
    super('Combat');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.combat);
    const gsm = getGsm(this);
    const isBoss = selectIsBossWave(gsm.getState());
    const wave = selectWave(gsm.getState());

    new TopBar(this, 'KAMPF (Auto-Battler)', () => '');

    // Bühne [B]: Held links, Gegner rechts (Platzhalter-Sprites).
    const stageY = GAME_HEIGHT * 0.42;
    this.add.rectangle(120, stageY, 90, 140, COLORS.hero).setStrokeStyle(3, 0xffffff);
    this.add.text(120, stageY + 95, 'HELD', { fontSize: '18px', color: COLORS.text }).setOrigin(0.5);

    const enemyCount = isBoss ? 1 : 3;
    for (let i = 0; i < enemyCount; i++) {
      const w = isBoss ? 160 : 70;
      const h = isBoss ? 200 : 110;
      this.add
        .rectangle(GAME_WIDTH - 140 - i * 90, stageY, w, h, COLORS.enemy)
        .setStrokeStyle(3, 0xffffff);
    }
    this.add
      .text(GAME_WIDTH - 140, stageY + 120, isBoss ? 'BOSS' : 'GEGNER', {
        fontSize: '18px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    // Test-Ballzahl skaliert leicht mit der Welle (Boss großzügiger).
    const testBalls = (isBoss ? 60 : 20) + wave.current * 5;

    // Steuer-Zone [D] unten (Daumen-Reichweite).
    createButton(
      this,
      CENTER_X,
      GAME_HEIGHT - 220,
      `Welle gewinnen  (+${testBalls} Bälle)`,
      () => eventBus.emit(GameEvent.CombatComplete, { balls: testBalls }),
      { fill: COLORS.accent, width: 460 },
    );

    createButton(
      this,
      CENTER_X,
      GAME_HEIGHT - 130,
      'Held stirbt (Run-Ende)',
      () => eventBus.emit(GameEvent.PlayerDied, {}),
      { fill: 0x444466, width: 460, height: 60 },
    );

    this.add
      .text(CENTER_X, GAME_HEIGHT - 64, 'Ability-Deck-Zone [D] — reserviert (Post-MVP)', {
        fontSize: '16px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }
}
