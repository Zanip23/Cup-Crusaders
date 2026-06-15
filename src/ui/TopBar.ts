// Gemeinsame Top-Bar (Region [A], docs/03): Phasenname, Welle X/N, Ballzähler.
// Liest live aus dem GameStateManager und aktualisiert sich bei StateChanged.

import Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '@/ui/layout';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectWave } from '@/core/state/selectors';

export class TopBar {
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly ballText: Phaser.GameObjects.Text;
  private readonly onChange: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    phaseLabel: string,
    private readonly ballLabel: (gsm: ReturnType<typeof getGsm>) => string,
  ) {
    const barHeight = 96; // ~8% von 1280
    scene.add.rectangle(GAME_WIDTH / 2, barHeight / 2, GAME_WIDTH, barHeight, COLORS.shop);

    scene.add.text(20, 16, phaseLabel, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: COLORS.muted,
    });

    this.waveText = scene.add.text(20, 48, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: COLORS.text,
      fontStyle: 'bold',
    });

    this.ballText = scene.add
      .text(GAME_WIDTH - 20, 48, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#f4c430',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    this.onChange = () => this.refresh();
    eventBus.on(GameEvent.StateChanged, this.onChange);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      eventBus.off(GameEvent.StateChanged, this.onChange),
    );

    this.refresh();
  }

  refresh(): void {
    const gsm = getGsm(this.scene);
    const wave = selectWave(gsm.getState());
    this.waveText.setText(`Welle ${wave.current}/${wave.total}`);
    this.ballText.setText(this.ballLabel(gsm));
  }
}
