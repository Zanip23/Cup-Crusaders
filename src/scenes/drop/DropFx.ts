import Phaser from 'phaser';
import { DROP_COLORS } from '@/scenes/drop/DropBoardRenderer';

export type BinFxKind = 'jackpot' | 'nearMiss' | 'good' | 'normal';

export function playStreamParticle(scene: Phaser.Scene, x: number, y: number): void {
  const mist = scene.add
    .circle(x + Phaser.Math.Between(-9, 9), y - 8, Phaser.Math.FloatBetween(2, 4), 0xdff7ff, 0.42)
    .setDepth(18);
  scene.tweens.add({
    targets: mist,
    y: y + Phaser.Math.Between(18, 34),
    alpha: 0,
    scale: 0.35,
    duration: 210,
    onComplete: () => mist.destroy(),
  });
}

export function playGateFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  strong: boolean,
): void {
  const color = strong ? '#fff4a3' : '#ffffff';
  const stroke = strong ? '#7a3f00' : '#0b1324';
  const text = scene.add
    .text(x, y - 30, label, {
      fontSize: strong ? '34px' : '26px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: strong ? 7 : 5,
    })
    .setOrigin(0.5)
    .setDepth(35);

  const glow = scene.add
    .circle(x, y, strong ? 46 : 34, strong ? 0xf4c430 : DROP_COLORS.glow, 0.28)
    .setDepth(6);
  scene.tweens.add({
    targets: glow,
    scale: 1.7,
    alpha: 0,
    duration: 360,
    onComplete: () => glow.destroy(),
  });
  scene.tweens.add({
    targets: text,
    y: y - 82,
    scale: strong ? 1.18 : 1.08,
    alpha: 0,
    duration: 620,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });

  for (let i = 0; i < (strong ? 14 : 8); i += 1) {
    const particle = scene.add
      .circle(x, y, Phaser.Math.FloatBetween(2, 4), strong ? 0xfff4a3 : 0xdff7ff, 0.92)
      .setDepth(34);
    scene.tweens.add({
      targets: particle,
      x: x + Phaser.Math.Between(-42, 42),
      y: y + Phaser.Math.Between(-34, 26),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(260, 460),
      onComplete: () => particle.destroy(),
    });
  }

  if (strong) scene.cameras.main.shake(110, 0.0045);
}

export function floatingContribution(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  result: BinFxKind,
): void {
  const jackpot = result === 'jackpot';
  const nearMiss = result === 'nearMiss';
  const good = result === 'good';
  const highContribution = jackpot || good || amount >= 10;
  const label = nearMiss ? `KNAPP! +${amount}` : jackpot ? `JACKPOT +${amount}` : `+${amount}`;
  const color = jackpot ? '#fff4a3' : good ? '#72f7a6' : nearMiss ? '#ffd3a6' : '#dff7ff';
  const stroke = jackpot ? '#6b3f00' : good ? '#074a26' : nearMiss ? '#633000' : '#0b1324';
  const burstColor = jackpot
    ? DROP_COLORS.jackpotGlow
    : good
      ? DROP_COLORS.greenGate
      : DROP_COLORS.nearMiss;
  const t = scene.add
    .text(x, y, label, {
      fontSize: jackpot ? '44px' : good ? '32px' : nearMiss ? '28px' : '22px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: jackpot ? 8 : good || nearMiss ? 6 : 5,
    })
    .setOrigin(0.5)
    .setScale(0.4)
    .setDepth(34);

  const burst = scene.add
    .circle(
      x,
      y,
      jackpot ? 76 : good ? 50 : nearMiss ? 42 : 26,
      burstColor,
      jackpot ? 0.46 : good ? 0.34 : nearMiss ? 0.28 : 0.16,
    )
    .setDepth(29);
  scene.tweens.add({
    targets: burst,
    scale: jackpot ? 2.35 : good ? 1.75 : nearMiss ? 1.55 : 1.2,
    alpha: 0,
    duration: jackpot ? 560 : good ? 440 : 360,
    ease: 'Cubic.easeOut',
    onComplete: () => burst.destroy(),
  });
  scene.tweens.add({
    targets: t,
    scale: jackpot ? 1.26 : good ? 1.14 : nearMiss ? 1.08 : 1,
    duration: 140,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: t,
    y: y - (jackpot ? 90 : good ? 66 : nearMiss ? 56 : 40),
    alpha: 0,
    delay: 90,
    duration: jackpot ? 860 : good ? 760 : nearMiss ? 720 : 600,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });

  if (highContribution) {
    const sparkleCount = jackpot ? 26 : amount >= 10 ? 16 : 10;
    for (let i = 0; i < sparkleCount; i += 1) addSparkle(scene, x, y, jackpot);
  }
}

function addSparkle(scene: Phaser.Scene, x: number, y: number, jackpot: boolean): void {
  const sparkle = scene.add
    .star(
      x,
      y,
      5,
      Phaser.Math.FloatBetween(2, 4),
      Phaser.Math.FloatBetween(jackpot ? 8 : 6, jackpot ? 14 : 10),
      jackpot ? 0xfff4a3 : 0x72f7a6,
      0.95,
    )
    .setDepth(33);
  scene.tweens.add({
    targets: sparkle,
    x: x + Phaser.Math.Between(jackpot ? -92 : -58, jackpot ? 92 : 58),
    y: y + Phaser.Math.Between(jackpot ? -84 : -52, jackpot ? 44 : 32),
    angle: Phaser.Math.Between(-180, 180),
    alpha: 0,
    scale: 0.15,
    duration: Phaser.Math.Between(340, jackpot ? 700 : 560),
    onComplete: () => sparkle.destroy(),
  });
}

export function playJackpotFx(scene: Phaser.Scene, x: number, y: number): void {
  scene.cameras.main.flash(240, 255, 210, 90, false, undefined, 0.24);
  scene.cameras.main.shake(260, 0.01);
  const glow = scene.add.circle(x, y, 92, DROP_COLORS.jackpotGlow, 0.42).setDepth(28);
  scene.tweens.add({
    targets: glow,
    scale: 2.8,
    alpha: 0,
    duration: 760,
    ease: 'Cubic.easeOut',
    onComplete: () => glow.destroy(),
  });
}
