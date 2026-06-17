import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import type { BoardDef } from '@/types/content';

export const DROP_COLORS = {
  caveTop: 0x07111f,
  caveBottom: 0x05070d,
  rockBack: 0x18334d,
  rockMid: 0x0d2136,
  rockFront: 0x071727,
  glow: 0x38bdf8,
  pinShadow: 0x02040a,
  pinOuter: 0xd7f3ff,
  pinCore: 0xffffff,
  yellowGate: 0xf2a91c,
  greenGate: 0x20b457,
  limeGate: 0x8db915,
  blueGate: 0x18aeea,
  mysteryGate: 0x7b4ee6,
  binFill: 0x101f35,
  woodDark: 0x8f5429,
  wood: 0xbf7134,
  woodLight: 0xe39045,
  funnelWood: 0xbf7134,
  funnelWoodLight: 0xe39045,
  funnelMetal: 0xb8c7d9,
  jackpotGlow: 0xffd166,
  nearMiss: 0xff8c42,
} as const;

export interface CupVisuals {
  cup: Phaser.GameObjects.Container;
  ammoText: Phaser.GameObjects.Text;
}

export function renderStageBackground(scene: Phaser.Scene): void {
  const bg = scene.add.graphics().setDepth(-20);
  bg.fillGradientStyle(
    DROP_COLORS.caveTop,
    DROP_COLORS.caveTop,
    DROP_COLORS.caveBottom,
    DROP_COLORS.caveBottom,
    1,
  );
  bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  renderRockLayer(scene, DROP_COLORS.rockBack, 0.42, 95, 0, -16);
  renderRockLayer(scene, DROP_COLORS.rockMid, 0.58, 135, 42, -12);
  renderRockLayer(scene, DROP_COLORS.rockFront, 0.76, 185, 84, -8);

  const glow = scene.add.graphics().setDepth(-9);
  glow.fillStyle(DROP_COLORS.glow, 0.11);
  glow.fillEllipse(CENTER_X, 520, GAME_WIDTH * 0.82, 760);
  glow.fillStyle(0xffffff, 0.05);
  glow.fillEllipse(CENTER_X, 300, GAME_WIDTH * 0.42, 260);

  const vignette = scene.add.graphics().setDepth(-8);
  vignette.fillStyle(0x000000, 0.34);
  vignette.fillRect(0, 0, 54, GAME_HEIGHT);
  vignette.fillRect(GAME_WIDTH - 54, 0, 54, GAME_HEIGHT);
  vignette.fillStyle(0x000000, 0.2);
  vignette.fillRect(0, 0, GAME_WIDTH, 88);
  vignette.fillRect(0, GAME_HEIGHT - 190, GAME_WIDTH, 190);

  for (let i = 0; i < 70; i += 1) {
    const x = Phaser.Math.Between(22, GAME_WIDTH - 22);
    const y = Phaser.Math.Between(105, GAME_HEIGHT - 235);
    const radius = Phaser.Math.FloatBetween(1.1, 2.7);
    const alpha = Phaser.Math.FloatBetween(0.08, 0.28);
    scene.add.circle(x, y, radius, 0xe8f5ff, alpha).setDepth(-7);
  }
}

function renderRockLayer(
  scene: Phaser.Scene,
  color: number,
  alpha: number,
  height: number,
  offset: number,
  depth: number,
): void {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(0, GAME_HEIGHT);
  for (let x = 0; x <= GAME_WIDTH + 90; x += 90) {
    const y =
      GAME_HEIGHT - height - Phaser.Math.Between(0, 90) - ((x + offset) % 180 === 0 ? 42 : 0);
    g.lineTo(x, y);
  }
  g.lineTo(GAME_WIDTH, GAME_HEIGHT);
  g.closePath();
  g.fillPath();
}

export function renderPeg(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  scene.add.circle(x + 4, y + 6, radius + 8, DROP_COLORS.pinShadow, 0.45).setDepth(2);
  scene.add.circle(x, y, radius + 5, DROP_COLORS.pinOuter, 0.92).setDepth(3);
  scene.add.circle(x, y, radius + 1, DROP_COLORS.pinCore, 0.98).setDepth(4);
  scene.add.circle(x - 4, y - 4, Math.max(3, radius * 0.38), 0xffffff, 0.95).setDepth(5);
}

export function renderBoardLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fontSize: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y + 1, normalizeGateLabel(label), {
      fontSize,
      color: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontStyle: '900',
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(14);
}

export function normalizeGateLabel(label: string): string {
  if (label.toLowerCase().startsWith('x')) return label.toUpperCase();
  if (label.includes('BOOST')) return '⌃⌃';
  return label;
}

export function gateColor(label: string): number {
  if (label.includes('?')) return DROP_COLORS.mysteryGate;
  if (label.includes('8') || label.includes('6') || label.includes('5'))
    return DROP_COLORS.greenGate;
  if (label.includes('4')) return DROP_COLORS.limeGate;
  if (label.includes('BOOST') || label.includes('▲')) return DROP_COLORS.blueGate;
  return DROP_COLORS.yellowGate;
}

export function renderWoodBeam(
  scene: Phaser.Scene,
  x: number,
  y: number,
  length: number,
  thickness: number,
  angleRad = 0,
  depth = 10,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setRotation(angleRad).setDepth(depth);
  const shadow = scene.add.graphics();
  shadow.fillStyle(DROP_COLORS.pinShadow, 0.38);
  shadow.fillRoundedRect(-length / 2 + 5, -thickness / 2 + 7, length, thickness + 8, thickness / 2);

  const body = scene.add.graphics();
  body.fillStyle(DROP_COLORS.woodDark, 1);
  body.fillRoundedRect(-length / 2, -thickness / 2, length, thickness, thickness / 2);
  body.fillStyle(DROP_COLORS.wood, 1);
  body.fillRoundedRect(
    -length / 2 + 3,
    -thickness / 2 + 2,
    length - 6,
    thickness - 7,
    (thickness - 7) / 2,
  );
  body.fillStyle(DROP_COLORS.woodLight, 0.72);
  body.fillRoundedRect(
    -length / 2 + 9,
    -thickness / 2 + 5,
    length - 18,
    Math.max(5, thickness * 0.2),
    thickness * 0.12,
  );
  body.lineStyle(2, 0x7b431f, 0.35);
  body.lineBetween(-length / 2 + 14, thickness * 0.12, length / 2 - 14, thickness * 0.12);
  container.add([shadow, body]);
  return container;
}

export function renderWoodPost(
  scene: Phaser.Scene,
  x: number,
  y: number,
  height: number,
  width = 32,
  angleRad = 0,
): Phaser.GameObjects.Container {
  return renderWoodBeam(scene, x, y, height, width, angleRad + Math.PI / 2, 13);
}

export function renderMultiplierBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
): Phaser.GameObjects.Container {
  const h = Math.max(42, height);
  const container = scene.add.container(x, y).setDepth(11);
  const shadow = scene.add.rectangle(5, 8, width, h + 4, DROP_COLORS.pinShadow, 0.42).setDepth(10);
  const bar = scene.add.rectangle(0, 0, width, h, color, 1).setDepth(11);
  const top = scene.add.rectangle(0, -h * 0.38, width, 5, 0xf8ef6a, 0.86).setDepth(12);
  container.add([shadow, bar, top]);
  const postHeight = h + 34;
  container.add(renderWoodPost(scene, -width / 2, 0, postHeight, 28));
  container.add(renderWoodPost(scene, width / 2, 0, postHeight, 28));

  if (label.includes('?')) {
    for (let ix = -width / 2 + 18; ix < width / 2; ix += 42) {
      container.add(
        renderBoardLabel(scene, ix, 1, '?', '30px')
          .setName('barLabel')
          .setRotation(ix % 84 === 0 ? -0.2 : 0.18),
      );
    }
  } else if (label.includes('BOOST') || label.includes('▲')) {
    container.add(renderBoardLabel(scene, 0, -1, '⌃⌃', '34px').setName('barLabel'));
  } else {
    container.add(renderBoardLabel(scene, 0, -1, label, '34px').setName('barLabel'));
  }
  return container;
}

export function revealMultiplierBarLabel(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  label: string,
): void {
  const existingLabels = container
    .getAll()
    .filter((child) => child.name === 'barLabel') as Phaser.GameObjects.GameObject[];
  existingLabels.forEach((child) => child.destroy());
  container.add(renderBoardLabel(scene, 0, -1, label, '34px').setName('barLabel'));
}

export function renderGate(
  scene: Phaser.Scene,
  gate: BoardDef['gates'][number],
): Phaser.GameObjects.Container {
  return renderMultiplierBar(
    scene,
    gate.x,
    gate.y,
    gate.w,
    gate.h,
    gate.label,
    gate.color ?? gateColor(gate.label),
  );
}

export function renderFunnelRail(
  scene: Phaser.Scene,
  x: number,
  y: number,
  length: number,
  thickness: number,
  angleDeg: number,
  color: number,
): void {
  const angle = Phaser.Math.DegToRad(angleDeg);
  scene.add
    .rectangle(x + 4, y + 6, length, thickness + 6, DROP_COLORS.pinShadow, 0.34)
    .setRotation(angle)
    .setDepth(6);
  scene.add
    .rectangle(x, y, length, thickness, color, 0.94)
    .setStrokeStyle(3, 0xffffff, 0.58)
    .setRotation(angle)
    .setDepth(8);
  scene.add
    .rectangle(
      x - Math.cos(angle) * length * 0.08,
      y - Math.sin(angle) * length * 0.08,
      length * 0.72,
      Math.max(3, thickness * 0.22),
      0xffffff,
      0.22,
    )
    .setRotation(angle)
    .setDepth(9);
}

export function renderBinSlot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  jackpot: boolean,
  safeEdge: boolean,
): void {
  const fill = jackpot ? DROP_COLORS.yellowGate : safeEdge ? 0x153958 : DROP_COLORS.binFill;
  const slot = scene.add.graphics().setDepth(7);
  slot.fillStyle(0x000000, 0.32);
  slot.fillRoundedRect(x - width / 2 + 5, y - 42 + 8, width - 10, 124, 18);
  slot.fillStyle(fill, jackpot ? 0.9 : 0.82);
  slot.fillRoundedRect(x - width / 2, y - 42, width, 124, jackpot ? 22 : 16);
  slot.lineStyle(jackpot ? 6 : 4, jackpot ? 0xffffff : DROP_COLORS.blueGate, jackpot ? 0.95 : 0.72);
  slot.strokeRoundedRect(x - width / 2, y - 42, width, 124, jackpot ? 22 : 16);

  scene.add
    .text(x, y + 8, label, {
      fontSize: jackpot ? '42px' : safeEdge ? '24px' : '30px',
      color: jackpot ? '#fff7bd' : '#ffffff',
      fontStyle: 'bold',
      stroke: jackpot ? '#5c3400' : '#06111f',
      strokeThickness: jackpot ? 8 : 6,
    })
    .setOrigin(0.5)
    .setDepth(9);
}

// Fester Fang-Becher unten: breiter, mit Akzent-Rand — fängt die Bälle auf.
export function renderCatcher(
  scene: Phaser.Scene,
  x: number,
  y: number,
  mouthWidth: number,
): CupVisuals {
  const visuals = renderCup(scene, x, y, 0, 1, mouthWidth);
  const glow = scene.add.ellipse(0, -20, mouthWidth + 18, 30, DROP_COLORS.glow, 0.32);
  visuals.cup.addAt(glow, 1);
  visuals.cup.setDepth(22);
  return visuals;
}

export function renderCup(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ammo: number,
  scale = 1,
  mouthWidth = 112,
): CupVisuals {
  const halfTop = mouthWidth / 2;
  const halfBottom = halfTop * 0.72;
  const bodyPts = (dx: number, dy: number): Phaser.Geom.Point[] => [
    new Phaser.Geom.Point(-halfTop + dx, -18 + dy),
    new Phaser.Geom.Point(halfTop + dx, -18 + dy),
    new Phaser.Geom.Point(halfBottom + dx, 30 + dy),
    new Phaser.Geom.Point(-halfBottom + dx, 30 + dy),
  ];

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.35);
  shadow.fillPoints(bodyPts(2, 1), true);
  shadow.setPosition(7, 9);

  const body = scene.add.graphics();
  body.fillGradientStyle(COLORS.accent, COLORS.accent, 0x8f2038, 0x8f2038, 1);
  body.fillPoints(bodyPts(0, 0), true);
  body.lineStyle(5, 0xffffff, 0.95);
  body.strokePoints(bodyPts(0, 0), true);

  const rim = scene.add
    .ellipse(0, -20, mouthWidth + 8, 24, 0xffffff, 0.96)
    .setStrokeStyle(3, 0xd7f3ff, 0.95);
  const innerRim = scene.add.ellipse(0, -20, mouthWidth - 12, 12, 0x6d1b31, 0.34);
  const shine = scene.add.rectangle(-halfTop * 0.42, -1, 13, 35, 0xffffff, 0.22).setRotation(0.16);
  const ammoText = scene.add
    .text(0, 7, `${ammo}`, {
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#6d1b31',
      strokeThickness: 6,
    })
    .setOrigin(0.5);
  const cup = scene.add
    .container(x, y, [shadow, body, rim, innerRim, shine, ammoText])
    .setDepth(20)
    .setScale(scale);
  cup.setSize(mouthWidth + 12, 64);
  return { cup, ammoText };
}
