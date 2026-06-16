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
  yellowGate: 0xf4c430,
  greenGate: 0x36d66b,
  blueGate: 0x4cc9f0,
  binFill: 0x101f35,
  funnelWood: 0x9a6738,
  funnelWoodLight: 0xd6a15a,
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
    .text(x, y + 1, label, {
      fontSize,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#182034',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(9);
}

export function gateColor(label: string): number {
  if (label.includes('4')) return DROP_COLORS.blueGate;
  if (label.includes('3')) return DROP_COLORS.greenGate;
  return DROP_COLORS.yellowGate;
}

export function renderGate(scene: Phaser.Scene, gate: BoardDef['gates'][number]): void {
  const fill = gate.color ?? gateColor(gate.label);
  scene.add
    .rectangle(gate.x + 7, gate.y + 8, gate.w + 18, gate.h + 12, DROP_COLORS.pinShadow, 0.42)
    .setDepth(6);
  scene.add
    .rectangle(gate.x, gate.y, gate.w + 12, gate.h + 10, fill, 0.95)
    .setStrokeStyle(6, 0xffffff, 0.9)
    .setDepth(7);
  scene.add
    .rectangle(
      gate.x,
      gate.y - gate.h * 0.2,
      gate.w - 10,
      Math.max(8, gate.h * 0.24),
      0xffffff,
      0.24,
    )
    .setDepth(8);
  scene.add
    .text(gate.x, gate.y + 1, gate.label, {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#182034',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(9);
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

export function renderCup(scene: Phaser.Scene, x: number, y: number, ammo: number): CupVisuals {
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.35);
  shadow.fillPoints(
    [
      new Phaser.Geom.Point(-58, -17),
      new Phaser.Geom.Point(58, -17),
      new Phaser.Geom.Point(43, 31),
      new Phaser.Geom.Point(-43, 31),
    ],
    true,
  );
  shadow.setPosition(7, 9);

  const body = scene.add.graphics();
  body.fillGradientStyle(COLORS.accent, COLORS.accent, 0x8f2038, 0x8f2038, 1);
  body.fillPoints(
    [
      new Phaser.Geom.Point(-56, -18),
      new Phaser.Geom.Point(56, -18),
      new Phaser.Geom.Point(40, 30),
      new Phaser.Geom.Point(-40, 30),
    ],
    true,
  );
  body.lineStyle(5, 0xffffff, 0.95);
  body.strokePoints(
    [
      new Phaser.Geom.Point(-56, -18),
      new Phaser.Geom.Point(56, -18),
      new Phaser.Geom.Point(40, 30),
      new Phaser.Geom.Point(-40, 30),
    ],
    true,
  );

  const rim = scene.add.ellipse(0, -20, 124, 24, 0xffffff, 0.96).setStrokeStyle(3, 0xd7f3ff, 0.95);
  const innerRim = scene.add.ellipse(0, -20, 100, 12, 0x6d1b31, 0.34);
  const shine = scene.add.rectangle(-24, -1, 13, 35, 0xffffff, 0.22).setRotation(0.16);
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
    .setDepth(20);
  cup.setSize(124, 64);
  return { cup, ammoText };
}
