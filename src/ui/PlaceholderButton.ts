// Einfacher Canvas-Button für die M1-Platzhalter-UI.
// Touch-Ziel ≥ 48px (ADR-011). Vollwertige DOM-Overlays kommen ab M4 (Shop).

import Phaser from 'phaser';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fill?: number;
  textColor?: string;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? 360;
  const height = Math.max(48, opts.height ?? 72); // WCAG-Mindestgröße
  const fill = opts.fill ?? 0xe94560;

  const bg = scene.add.rectangle(0, 0, width, height, fill).setStrokeStyle(3, 0xffffff, 0.9);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: opts.textColor ?? '#ffffff',
      align: 'center',
      wordWrap: { width: width - 24 },
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on('pointerover', () => bg.setScale(1.04));
  container.on('pointerout', () => bg.setScale(1));
  container.on('pointerdown', () => bg.setScale(0.97));
  container.on('pointerup', () => {
    bg.setScale(1.04);
    onClick();
  });

  return container;
}
