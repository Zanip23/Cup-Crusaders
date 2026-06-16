import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import { TopBar } from '@/ui/TopBar';
import { createButton } from '@/ui/PlaceholderButton';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectBallsFromCombat } from '@/core/state/selectors';
import { BOARD_BASIC, BOARD_REGISTRY } from '@/content/boards/basic';
import { getLevel } from '@/content/levels';
import { applyGateEffect, DropResolver } from '@/systems/drop/DropResolver';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { StatKey } from '@/core/stats/StatTypes';
import type { BoardDef } from '@/types/content';

// Drop-Phase mit echter Matter.js-Physik (ADR-009, docs/05). Physik-autoritativ:
// Bälle sind Value-Carrying Bodies; Tore/Bins sind Sensoren; der DropResolver
// summiert nur tatsächliche Ergebnisse — kein Steering.

type MatterBody = MatterJS.BodyType & { gameObject?: Phaser.GameObjects.Arc | null };

const BALL_RADIUS = 8;
const DRIP_INTERVAL_MS = 34;
const MAX_BONUS_BALLS_PER_GATE = 4;
const STRONG_GATE_THRESHOLD = 3;
const SPIN_TIMEOUT_MS = 18000; // Timeout-Sicherung: Phase endet garantiert
const CUP_Y = 180;

const DROP_COLORS = {
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
};

export class DropScene extends Phaser.Scene {
  private board!: BoardDef;
  private resolver!: DropResolver;
  private cup!: Phaser.GameObjects.Container;
  private cupAmmoText!: Phaser.GameObjects.Text;
  private sumText!: Phaser.GameObjects.Text;
  private ammo = 0;
  private spawned = 0;
  private releasing = false;
  private allSpawned = false;
  private finished = false;
  private readonly active = new Set<Phaser.GameObjects.Arc>();
  private dripTimer?: Phaser.Time.TimerEvent;
  private cupHintText?: Phaser.GameObjects.Text;
  private cupDragStartX = 0;
  private cupWasDragged = false;
  private cupDisplayedAmmo = 0;
  private collisionHandler?: (e: Phaser.Physics.Matter.Events.CollisionStartEvent) => void;

  constructor() {
    // Matter nur in dieser Szene aktiv (docs/01) — per-Scene-Physics-Config.
    super({
      key: 'Drop',
      physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 }, debug: false } },
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(DROP_COLORS.caveBottom);
    this.resetState();

    const gsm = getGsm(this);
    const level = getLevel(gsm.getState().run.levelId);
    this.board = BOARD_REGISTRY[level.boardId] ?? BOARD_BASIC;
    // Munition = Kampf-Bälle + StartingBalls (Upgrade/Item, additiv vor Drop-Start).
    const startingBalls = buildHeroStats(gsm.getState().run, gsm.getState().meta).get(
      StatKey.StartingBalls,
    );
    this.ammo = selectBallsFromCombat(gsm.getState()) + Math.round(startingBalls);
    this.resolver = new DropResolver();

    new TopBar(this, 'DROP (Pachinko)', () => `🏐 ${this.ammo}`);

    this.sumText = this.add
      .text(CENTER_X, 130, 'Σ 0', { fontSize: '26px', color: '#f4c430', fontStyle: 'bold' })
      .setOrigin(0.5);

    this.buildBoard();
    this.buildCup();
    this.buildControls();
    this.setupKeyboard();
    this.registerCollisions();

    // Periodischer End-Check + Off-Screen-Despawn.
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.sweep() });

    // Matter-World-Handler bei Szenen-Shutdown abmelden. Die per-Scene-Matter-World
    // wird beim Shutdown ohnehin verworfen (this.matter.world ist dann ggf. null) →
    // null-sicher zugreifen.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.collisionHandler) this.matter?.world?.off('collisionstart', this.collisionHandler);
      this.dripTimer?.remove();
    });
  }

  private resetState(): void {
    this.spawned = 0;
    this.releasing = false;
    this.allSpawned = false;
    this.finished = false;
    this.active.clear();
  }

  // ---- Board-Aufbau ------------------------------------------------------

  private buildBoard(): void {
    const m = this.matter;
    this.buildStageBackground();

    // Wände + Floor (statisch, nicht-Sensor).
    m.add.rectangle(-10, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { isStatic: true, label: 'wall' });
    m.add.rectangle(GAME_WIDTH + 10, GAME_HEIGHT / 2, 20, GAME_HEIGHT, {
      isStatic: true,
      label: 'wall',
    });
    m.add.rectangle(CENTER_X, GAME_HEIGHT - 30, GAME_WIDTH, 20, { isStatic: true, label: 'wall' });

    // Pegs als glänzende Pins.
    for (const peg of this.board.pegs) {
      m.add.circle(peg.x, peg.y, peg.radius, {
        isStatic: true,
        restitution: this.board.defaultRestitution,
        label: 'peg',
      });
      this.add
        .circle(peg.x + 4, peg.y + 6, peg.radius + 8, DROP_COLORS.pinShadow, 0.45)
        .setDepth(2);
      this.add.circle(peg.x, peg.y, peg.radius + 5, DROP_COLORS.pinOuter, 0.92).setDepth(3);
      this.add.circle(peg.x, peg.y, peg.radius + 1, DROP_COLORS.pinCore, 0.98).setDepth(4);
      this.add
        .circle(peg.x - 4, peg.y - 4, Math.max(3, peg.radius * 0.38), 0xffffff, 0.95)
        .setDepth(5);
    }

    // Moderne Board-Elemente sind optional, damit ältere Boards ohne neue Felder
    // weiterhin funktionieren.
    this.board.ramps?.forEach((ramp) => {
      const angle = Phaser.Math.DegToRad(ramp.angle);
      m.add.rectangle(ramp.x, ramp.y, ramp.w, ramp.h, {
        isStatic: true,
        angle,
        restitution: this.board.defaultRestitution,
        label: 'ramp',
      });
      this.add
        .rectangle(ramp.x, ramp.y, ramp.w, ramp.h, ramp.color ?? DROP_COLORS.pinOuter, 0.88)
        .setStrokeStyle(3, 0xffffff, 0.72)
        .setRotation(angle)
        .setDepth(6);
      if (ramp.label) this.addBoardLabel(ramp.x, ramp.y, ramp.label, '20px');
    });

    this.board.blockers?.forEach((blocker) => {
      const angle = Phaser.Math.DegToRad(blocker.angle ?? 0);
      m.add.rectangle(blocker.x, blocker.y, blocker.w, blocker.h, {
        isStatic: true,
        angle,
        restitution: this.board.defaultRestitution * 0.85,
        label: 'blocker',
      });
      this.add
        .rectangle(blocker.x, blocker.y, blocker.w, blocker.h, blocker.color ?? 0xff6b6b, 0.9)
        .setStrokeStyle(3, 0xffffff, 0.65)
        .setRotation(angle)
        .setDepth(6);
    });

    this.board.bumpers?.forEach((bumper) => {
      m.add.circle(bumper.x, bumper.y, bumper.radius, {
        isStatic: true,
        restitution: Math.max(1.05, this.board.defaultRestitution + 0.75),
        label: 'bumper',
      });
      this.add
        .circle(bumper.x + 5, bumper.y + 7, bumper.radius + 7, DROP_COLORS.pinShadow, 0.42)
        .setDepth(6);
      this.add
        .circle(bumper.x, bumper.y, bumper.radius + 4, bumper.color ?? DROP_COLORS.blueGate, 0.94)
        .setStrokeStyle(5, 0xffffff, 0.88)
        .setDepth(7);
      this.add
        .circle(bumper.x - 7, bumper.y - 7, Math.max(5, bumper.radius * 0.25), 0xffffff, 0.5)
        .setDepth(8);
    });

    // Plattformen sind breite Multiplikator-/Bonus-Zonen auf mehreren Höhen.
    this.board.platforms?.forEach((platform, i) => {
      const angle = Phaser.Math.DegToRad(platform.angle ?? 0);
      m.add.rectangle(platform.x, platform.y, platform.w, platform.h, {
        isStatic: true,
        isSensor: true,
        angle,
        label: `platform:${i}`,
      });
      this.add
        .rectangle(
          platform.x + 7,
          platform.y + 8,
          platform.w + 18,
          platform.h + 12,
          DROP_COLORS.pinShadow,
          0.42,
        )
        .setRotation(angle)
        .setDepth(6);
      this.add
        .rectangle(
          platform.x,
          platform.y,
          platform.w,
          platform.h,
          platform.color ?? this.gateColor(platform.label),
          0.94,
        )
        .setStrokeStyle(5, 0xffffff, 0.86)
        .setRotation(angle)
        .setDepth(7);
      this.addBoardLabel(platform.x, platform.y, platform.label, '28px');
    });

    this.board.boosters?.forEach((booster, i) => {
      const angle = Phaser.Math.DegToRad(booster.angle ?? 0);
      m.add.rectangle(booster.x, booster.y, booster.w, booster.h, {
        isStatic: true,
        isSensor: true,
        angle,
        label: `booster:${i}`,
      });
      this.add
        .rectangle(booster.x, booster.y, booster.w, booster.h, booster.color ?? 0xff4fd8, 0.9)
        .setStrokeStyle(5, 0xffffff, 0.86)
        .setRotation(angle)
        .setDepth(7);
      this.addBoardLabel(booster.x, booster.y, booster.label, '20px');
    });

    // Tore (Sensoren) als breite, farbige Multiplikator-Balken.
    this.board.gates.forEach((g, i) => {
      m.add.rectangle(g.x, g.y, g.w, g.h, { isStatic: true, isSensor: true, label: `gate:${i}` });
      const fill = g.color ?? this.gateColor(g.label);
      this.add
        .rectangle(g.x + 7, g.y + 8, g.w + 18, g.h + 12, DROP_COLORS.pinShadow, 0.42)
        .setDepth(6);
      this.add
        .rectangle(g.x, g.y, g.w + 12, g.h + 10, fill, 0.95)
        .setStrokeStyle(6, 0xffffff, 0.9)
        .setDepth(7);
      this.add
        .rectangle(g.x, g.y - g.h * 0.2, g.w - 10, Math.max(8, g.h * 0.24), 0xffffff, 0.24)
        .setDepth(8);
      this.add
        .text(g.x, g.y + 1, g.label, {
          fontSize: '32px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#182034',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(9);
    });

    // Funnel-Catcher: sichtbare Rampen, Pins und Sensoren bilden dieselbe Geometrie ab.
    const binTop = GAME_HEIGHT - 360;
    const throatY = binTop - 26;
    const sensorY = binTop + 58;
    const binBottom = GAME_HEIGHT - 92;
    const binCenters = this.board.bins.map((b) => b.x + b.w / 2);
    const jackpotIndex = this.board.bins.reduce(
      (best, bin, i) => (bin.multiplier > this.board.bins[best].multiplier ? i : best),
      0,
    );
    const jackpotCenter = binCenters[jackpotIndex] ?? CENTER_X;

    const funnelBack = this.add.graphics().setDepth(5);
    funnelBack.fillStyle(0x06111f, 0.78);
    funnelBack.fillRoundedRect(18, binTop - 96, GAME_WIDTH - 36, 212, 24);
    funnelBack.lineStyle(4, 0xd7f3ff, 0.25);
    funnelBack.strokeRoundedRect(18, binTop - 96, GAME_WIDTH - 36, 212, 24);

    this.addFunnelRail(66, binTop - 110, 210, 24, -24, DROP_COLORS.funnelWoodLight, 'wall');
    this.addFunnelRail(
      GAME_WIDTH - 66,
      binTop - 110,
      210,
      24,
      24,
      DROP_COLORS.funnelWoodLight,
      'wall',
    );
    this.addFunnelRail(142, binTop - 18, 178, 20, -14, DROP_COLORS.funnelWood, 'wall');
    this.addFunnelRail(GAME_WIDTH - 142, binTop - 18, 178, 20, 14, DROP_COLORS.funnelWood, 'wall');

    const jackpotGlow = this.add
      .circle(jackpotCenter, sensorY, 92, DROP_COLORS.jackpotGlow, 0.2)
      .setDepth(6);
    this.tweens.add({
      targets: jackpotGlow,
      scale: { from: 0.9, to: 1.18 },
      alpha: { from: 0.16, to: 0.34 },
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.board.bins.forEach((b, i) => {
      const cx = b.x + b.w / 2;
      const jackpot = i === jackpotIndex;
      const safeEdge = i === 0 || i === this.board.bins.length - 1;
      const sensorW = b.w - (jackpot ? 2 : 10);
      m.add.rectangle(cx, sensorY, sensorW, 92, {
        isStatic: true,
        isSensor: true,
        label: `bin:${i}`,
      });

      const fill = jackpot ? DROP_COLORS.yellowGate : safeEdge ? 0x153958 : DROP_COLORS.binFill;
      const slot = this.add.graphics().setDepth(7);
      slot.fillStyle(0x000000, 0.32);
      slot.fillRoundedRect(cx - sensorW / 2 + 5, sensorY - 42 + 8, sensorW - 10, 124, 18);
      slot.fillStyle(fill, jackpot ? 0.9 : 0.82);
      slot.fillRoundedRect(cx - sensorW / 2, sensorY - 42, sensorW, 124, jackpot ? 22 : 16);
      slot.lineStyle(
        jackpot ? 6 : 4,
        jackpot ? 0xffffff : DROP_COLORS.blueGate,
        jackpot ? 0.95 : 0.72,
      );
      slot.strokeRoundedRect(cx - sensorW / 2, sensorY - 42, sensorW, 124, jackpot ? 22 : 16);

      this.add
        .text(cx, sensorY + 8, b.label, {
          fontSize: jackpot ? '42px' : safeEdge ? '24px' : '30px',
          color: jackpot ? '#fff7bd' : '#ffffff',
          fontStyle: 'bold',
          stroke: jackpot ? '#5c3400' : '#06111f',
          strokeThickness: jackpot ? 8 : 6,
        })
        .setOrigin(0.5)
        .setDepth(9);

      if (safeEdge) this.addBoardLabel(cx, sensorY - 50, 'SAFE', '16px');
      if (jackpot) this.addBoardLabel(cx, sensorY - 58, 'JACKPOT', '20px');

      if (i > 0) {
        const dividerX = b.x;
        const leftNearJackpot = i === jackpotIndex || i - 1 === jackpotIndex;
        const dividerH = leftNearJackpot ? 142 : 112;
        this.addFunnelRail(
          dividerX,
          binTop + 16,
          dividerH,
          leftNearJackpot ? 16 : 12,
          leftNearJackpot ? (dividerX < jackpotCenter ? -8 : 8) : 0,
          leftNearJackpot ? DROP_COLORS.funnelMetal : DROP_COLORS.funnelWoodLight,
          'wall',
        );
      }
    });

    const catcherPins = [
      { x: jackpotCenter - 92, y: throatY, r: 13 },
      { x: jackpotCenter + 92, y: throatY, r: 13 },
      { x: jackpotCenter - 46, y: throatY + 38, r: 9 },
      { x: jackpotCenter + 46, y: throatY + 38, r: 9 },
    ];
    catcherPins.forEach((pin) => {
      m.add.circle(pin.x, pin.y, pin.r, {
        isStatic: true,
        restitution: this.board.defaultRestitution + 0.15,
        label: 'catcher-pin',
      });
      this.add.circle(pin.x + 3, pin.y + 4, pin.r + 5, DROP_COLORS.pinShadow, 0.38).setDepth(8);
      this.add.circle(pin.x, pin.y, pin.r + 3, DROP_COLORS.funnelMetal, 0.96).setDepth(9);
      this.add.circle(pin.x - 3, pin.y - 3, Math.max(3, pin.r * 0.32), 0xffffff, 0.72).setDepth(10);
    });

    this.add.rectangle(CENTER_X, binBottom, GAME_WIDTH - 78, 10, 0xffffff, 0.18).setDepth(8);
  }

  private addFunnelRail(
    x: number,
    y: number,
    length: number,
    thickness: number,
    angleDeg: number,
    color: number,
    label: string,
  ): void {
    const angle = Phaser.Math.DegToRad(angleDeg);
    this.matter.add.rectangle(x, y, length, thickness, {
      isStatic: true,
      angle,
      restitution: this.board.defaultRestitution * 0.9,
      label,
    });
    this.add
      .rectangle(x + 4, y + 6, length, thickness + 6, DROP_COLORS.pinShadow, 0.34)
      .setRotation(angle)
      .setDepth(6);
    this.add
      .rectangle(x, y, length, thickness, color, 0.94)
      .setStrokeStyle(3, 0xffffff, 0.58)
      .setRotation(angle)
      .setDepth(8);
    this.add
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

  private buildStageBackground(): void {
    const bg = this.add.graphics().setDepth(-20);
    bg.fillGradientStyle(
      DROP_COLORS.caveTop,
      DROP_COLORS.caveTop,
      DROP_COLORS.caveBottom,
      DROP_COLORS.caveBottom,
      1,
    );
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawRockLayer(DROP_COLORS.rockBack, 0.42, 95, 0, -16);
    this.drawRockLayer(DROP_COLORS.rockMid, 0.58, 135, 42, -12);
    this.drawRockLayer(DROP_COLORS.rockFront, 0.76, 185, 84, -8);

    const glow = this.add.graphics().setDepth(-9);
    glow.fillStyle(DROP_COLORS.glow, 0.11);
    glow.fillEllipse(CENTER_X, 520, GAME_WIDTH * 0.82, 760);
    glow.fillStyle(0xffffff, 0.05);
    glow.fillEllipse(CENTER_X, 300, GAME_WIDTH * 0.42, 260);

    const vignette = this.add.graphics().setDepth(-8);
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
      this.add.circle(x, y, radius, 0xe8f5ff, alpha).setDepth(-7);
    }
  }

  private drawRockLayer(
    color: number,
    alpha: number,
    height: number,
    offset: number,
    depth: number,
  ): void {
    const g = this.add.graphics().setDepth(depth);
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

  private gateColor(label: string): number {
    if (label.includes('4')) return DROP_COLORS.blueGate;
    if (label.includes('3')) return DROP_COLORS.greenGate;
    return DROP_COLORS.yellowGate;
  }

  private addBoardLabel(x: number, y: number, label: string, fontSize: string): void {
    this.add
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

  private buildCup(): void {
    const shadow = this.add.graphics();
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

    const body = this.add.graphics();
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

    const rim = this.add.ellipse(0, -20, 124, 24, 0xffffff, 0.96).setStrokeStyle(3, 0xd7f3ff, 0.95);
    const innerRim = this.add.ellipse(0, -20, 100, 12, 0x6d1b31, 0.34);
    const shine = this.add.rectangle(-24, -1, 13, 35, 0xffffff, 0.22).setRotation(0.16);
    this.cupDisplayedAmmo = this.ammo;
    this.cupAmmoText = this.add
      .text(0, 7, `${this.ammo}`, {
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#6d1b31',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.cup = this.add
      .container(CENTER_X, CUP_Y, [shadow, body, rim, innerRim, shine, this.cupAmmoText])
      .setDepth(20);
    this.cup.setSize(124, 64);
    this.cup.setInteractive({ useHandCursor: true, draggable: true });

    this.cup.on('pointerdown', () => {
      this.cupDragStartX = this.cup.x;
      this.cupWasDragged = false;
      this.tweens.add({
        targets: this.cup,
        scaleX: 1.04,
        scaleY: 0.97,
        duration: 90,
        ease: 'Sine.easeOut',
      });
    });

    // Drag (horizontal) bewegt den Becher direkt und kippt ihn leicht in Zugrichtung.
    this.input.on(
      'drag',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number) => {
        if (obj !== this.cup || this.releasing || this.finished) return;
        const nextX = Phaser.Math.Clamp(dragX, 70, GAME_WIDTH - 70);
        const delta = nextX - this.cup.x;
        this.cup.x = nextX;
        this.cup.rotation = Phaser.Math.Clamp(delta * 0.012, -0.16, 0.16);
        if (Math.abs(this.cup.x - this.cupDragStartX) > 8) this.cupWasDragged = true;
      },
    );

    this.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (obj === this.cup) this.settleCupTilt();
    });

    // Tap auf den Becher startet den Drop; ein vorheriger Drag zählt nur als Positionieren.
    this.cup.on('pointerup', () => {
      this.settleCupTilt();
      if (!this.cupWasDragged) this.release();
    });
  }

  private buildControls(): void {
    this.cupHintText = this.add
      .text(CENTER_X, CUP_Y + 66, 'Becher antippen oder ziehen • Space/Enter zum Start', {
        fontSize: '18px',
        color: '#d7f3ff',
        stroke: '#06111f',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0.82)
      .setDepth(19);

    // WCAG 2.5.7: Drag-Funktion zusätzlich über dezente Buttons bedienbar.
    createButton(this, 78, GAME_HEIGHT - 92, '◀', () => this.nudgeCup(-44), {
      fill: 0x24344f,
      width: 76,
      height: 46,
    }).setAlpha(0.74);
    createButton(this, GAME_WIDTH - 78, GAME_HEIGHT - 92, '▶', () => this.nudgeCup(44), {
      fill: 0x24344f,
      width: 76,
      height: 46,
    }).setAlpha(0.74);
  }

  private nudgeCup(dx: number): void {
    if (this.releasing || this.finished) return;
    this.cup.x = Phaser.Math.Clamp(this.cup.x + dx, 70, GAME_WIDTH - 70);
    this.cup.rotation = Phaser.Math.Clamp(dx * 0.004, -0.14, 0.14);
    this.settleCupTilt();
  }

  private settleCupTilt(): void {
    this.tweens.add({
      targets: this.cup,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 190,
      ease: 'Back.easeOut',
    });
  }

  // Tastatur als zusätzliche Eingabe (A11y/Desktop): ←/→ bewegen, Leer/Enter schüttet aus.
  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-LEFT', () => this.nudgeCup(-50));
    kb.on('keydown-RIGHT', () => this.nudgeCup(50));
    kb.on('keydown-SPACE', () => this.release());
    kb.on('keydown-ENTER', () => this.release());
  }

  // ---- Ball-Lebenszyklus -------------------------------------------------

  private release(): void {
    if (this.releasing || this.finished) return;
    if (this.ammo <= 0) {
      this.finish();
      return;
    }
    this.releasing = true;
    this.cup.disableInteractive();
    this.cupHintText?.setText('Ausschütten läuft …');
    this.playCupReleaseFeedback();
    this.dripTimer = this.time.addEvent({
      delay: DRIP_INTERVAL_MS,
      loop: true,
      callback: () => this.dripOne(),
    });
    // Globale Timeout-Sicherung.
    this.time.delayedCall(SPIN_TIMEOUT_MS, () => this.forceEnd());
  }

  private dripOne(): void {
    if (this.finished) return;
    if (this.active.size >= this.board.maxConcurrentBalls) return; // Performance-Cap
    if (this.spawned >= this.ammo) {
      this.allSpawned = true;
      return;
    }
    this.spawned += 1;
    this.updateCupAmmo(this.ammo - this.spawned);

    const x = this.cup.x + Phaser.Math.Between(-22, 22);
    const y = CUP_Y + Phaser.Math.Between(18, 34);
    const ball = this.add.circle(x, y, BALL_RADIUS, 0xffffff);
    ball.setData('value', 1);
    ball.setData('gates', new Set<string>());
    this.matter.add.gameObject(ball, {
      shape: { type: 'circle', radius: BALL_RADIUS },
      restitution: this.board.defaultRestitution,
      friction: 0,
      frictionAir: 0.008,
      label: 'ball',
    });
    const body = ball.body as MatterBody;
    body.collisionFilter.group = -1; // Bälle kollidieren nicht untereinander (Perf)
    body.velocity.x = Phaser.Math.FloatBetween(-0.9, 0.9) + (x - this.cup.x) * 0.025;
    body.velocity.y = Phaser.Math.FloatBetween(1.2, 2.7);
    this.active.add(ball);
    this.playStreamParticle(x, y);
  }

  private playCupReleaseFeedback(): void {
    this.tweens.killTweensOf(this.cup);
    this.cup.rotation = -0.08;
    this.tweens.add({
      targets: this.cup,
      rotation: { from: -0.1, to: 0.1 },
      scaleX: { from: 1.08, to: 0.98 },
      scaleY: { from: 0.94, to: 1.04 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => this.settleCupTilt(),
    });
    this.cameras.main.shake(90, 0.0025);
  }

  private updateCupAmmo(value: number): void {
    const counter = { value: this.cupDisplayedAmmo };
    this.cupDisplayedAmmo = value;
    this.tweens.killTweensOf(this.cupAmmoText);
    this.tweens.add({
      targets: counter,
      value,
      duration: Math.max(70, DRIP_INTERVAL_MS * 1.8),
      ease: 'Sine.easeOut',
      onUpdate: () => this.cupAmmoText.setText(`${Math.round(counter.value)}`),
      onComplete: () => this.cupAmmoText.setText(`${value}`),
    });
    this.tweens.add({
      targets: this.cupAmmoText,
      scale: 1.22,
      duration: 55,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private playStreamParticle(x: number, y: number): void {
    const mist = this.add
      .circle(x + Phaser.Math.Between(-9, 9), y - 8, Phaser.Math.FloatBetween(2, 4), 0xdff7ff, 0.42)
      .setDepth(18);
    this.tweens.add({
      targets: mist,
      y: y + Phaser.Math.Between(18, 34),
      alpha: 0,
      scale: 0.35,
      duration: 210,
      onComplete: () => mist.destroy(),
    });
  }

  private registerCollisions(): void {
    this.collisionHandler = (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA as MatterBody;
        const b = pair.bodyB as MatterBody;
        let ballBody: MatterBody | null = null;
        let other = '';
        if (a.label === 'ball') {
          ballBody = a;
          other = b.label;
        } else if (b.label === 'ball') {
          ballBody = b;
          other = a.label;
        }
        if (!ballBody) continue;
        const go = ballBody.gameObject;
        if (!go || !go.active) continue;
        if (other.startsWith('gate:'))
          this.handleGate(
            go,
            `gate:${other.slice(5)}`,
            this.board.gates[Number(other.slice(5))].effect,
          );
        else if (other.startsWith('platform:'))
          this.handleGate(
            go,
            `platform:${other.slice(9)}`,
            this.board.platforms?.[Number(other.slice(9))]?.effect,
          );
        else if (other.startsWith('booster:'))
          this.handleBooster(go, ballBody, Number(other.slice(8)));
        else if (other.startsWith('bin:')) this.handleBin(go, Number(other.slice(4)));
      }
    };
    this.matter.world.on('collisionstart', this.collisionHandler);
  }

  private handleGate(
    go: Phaser.GameObjects.Arc,
    id: string,
    effect: BoardDef['gates'][number]['effect'] | undefined,
  ): void {
    if (!effect) return;
    const passed = go.getData('gates') as Set<string>;
    if (passed.has(id)) return; // pro Ball nur einmal pro Zone
    passed.add(id);

    const previousValue = go.getData('value') as number;
    const value = applyGateEffect(previousValue, effect);
    go.setData('value', value);
    this.flashBallValue(go, value);

    if (effect.type === 'gateMultiply') {
      const factor = Math.max(1, Math.floor(Number(effect.params.factor ?? 1)));
      const bonusCount = Math.min(factor - 1, MAX_BONUS_BALLS_PER_GATE);
      this.spawnBonusBalls(go, bonusCount, previousValue, passed);
      this.playGateJuice(go.x, go.y, `x${factor}!`, factor >= STRONG_GATE_THRESHOLD);
      return;
    }

    if (effect.type === 'gateAdd') {
      const amount = Math.max(0, Math.floor(Number(effect.params.amount ?? 0)));
      const bonusCount = Math.min(Math.floor(amount / 5), MAX_BONUS_BALLS_PER_GATE);
      if (bonusCount > 0) this.spawnBonusBalls(go, bonusCount, 1, passed);
      this.playGateJuice(go.x, go.y, `+${amount}!`, amount >= 5);
    }
  }

  private spawnBonusBalls(
    sourceBall: Phaser.GameObjects.Arc,
    count: number,
    inheritedValue: number,
    inheritedGates?: Set<string>,
  ): void {
    const availableSlots = this.board.maxConcurrentBalls - this.active.size;
    const spawnCount = Math.max(0, Math.min(count, MAX_BONUS_BALLS_PER_GATE, availableSlots));
    if (spawnCount <= 0) return;

    const sourceBody = sourceBall.body as MatterBody | null;
    for (let i = 0; i < spawnCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const spread = 10 + Math.floor(i / 2) * 7;
      const x = Phaser.Math.Clamp(
        sourceBall.x + side * spread,
        BALL_RADIUS,
        GAME_WIDTH - BALL_RADIUS,
      );
      const y = sourceBall.y - Phaser.Math.Between(4, 12);
      const ball = this.add.circle(x, y, BALL_RADIUS, 0xdff7ff).setDepth(sourceBall.depth);
      ball.setData('value', inheritedValue);
      ball.setData('gates', new Set(inheritedGates ?? []));
      this.matter.add.gameObject(ball, {
        shape: { type: 'circle', radius: BALL_RADIUS },
        restitution: this.board.defaultRestitution,
        friction: 0,
        frictionAir: 0.008,
        label: 'ball',
      });
      const body = ball.body as MatterBody;
      body.collisionFilter.group = -1; // Bälle kollidieren nicht untereinander (Perf)
      body.velocity.x =
        (sourceBody?.velocity.x ?? 0) * 0.35 + side * Phaser.Math.FloatBetween(1.7, 3.2);
      body.velocity.y =
        Math.min(sourceBody?.velocity.y ?? 0, -1.5) - Phaser.Math.FloatBetween(0.8, 2.2);
      this.active.add(ball);
      this.flashBallValue(ball, inheritedValue);
    }
  }

  private flashBallValue(go: Phaser.GameObjects.Arc, value: number): void {
    go.setFillStyle(value >= 10 ? 0xf4c430 : value >= 2 ? 0xffa726 : 0xffffff);
    this.tweens.add({ targets: go, scale: 1.55, alpha: 0.78, duration: 90, yoyo: true });
  }

  private playGateJuice(x: number, y: number, label: string, strong: boolean): void {
    const color = strong ? '#fff4a3' : '#ffffff';
    const stroke = strong ? '#7a3f00' : '#0b1324';
    const text = this.add
      .text(x, y - 30, label, {
        fontSize: strong ? '34px' : '26px',
        color,
        fontStyle: 'bold',
        stroke,
        strokeThickness: strong ? 7 : 5,
      })
      .setOrigin(0.5)
      .setDepth(35);

    const glow = this.add
      .circle(x, y, strong ? 46 : 34, strong ? 0xf4c430 : DROP_COLORS.glow, 0.28)
      .setDepth(6);
    this.tweens.add({
      targets: glow,
      scale: 1.7,
      alpha: 0,
      duration: 360,
      onComplete: () => glow.destroy(),
    });
    this.tweens.add({
      targets: text,
      y: y - 82,
      scale: strong ? 1.18 : 1.08,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });

    for (let i = 0; i < (strong ? 14 : 8); i += 1) {
      const particle = this.add
        .circle(x, y, Phaser.Math.FloatBetween(2, 4), strong ? 0xfff4a3 : 0xdff7ff, 0.92)
        .setDepth(34);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-42, 42),
        y: y + Phaser.Math.Between(-34, 26),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(260, 460),
        onComplete: () => particle.destroy(),
      });
    }

    if (strong) this.cameras.main.shake(110, 0.0045);
  }

  private handleBooster(go: Phaser.GameObjects.Arc, body: MatterBody, index: number): void {
    const booster = this.board.boosters?.[index];
    if (!booster) return;
    this.handleGate(go, `booster:${index}`, booster.effect);
    body.velocity.x += Phaser.Math.FloatBetween(-2.4, 2.4);
    body.velocity.y = Math.min(body.velocity.y, -7.5);
    this.tweens.add({ targets: go, alpha: 0.45, duration: 60, yoyo: true });
  }

  private handleBin(go: Phaser.GameObjects.Arc, index: number): void {
    if (go.getData('resolved')) return;
    go.setData('resolved', true);
    const bin = this.board.bins[index];
    const contribution = this.resolver.collect(go.getData('value') as number, bin.multiplier);
    this.floatingContribution(go.x, go.y, contribution, this.binResultKind(index));
    this.despawn(go);
    this.sumText.setText(`Σ ${this.resolver.total()}`);
    this.checkEnd();
  }

  private despawn(go: Phaser.GameObjects.Arc): void {
    this.active.delete(go);
    if (go.body) this.matter.world.remove(go.body as MatterJS.BodyType);
    go.destroy();
  }

  private binResultKind(index: number): 'jackpot' | 'nearMiss' | 'normal' {
    const jackpotIndex = this.board.bins.reduce(
      (best, bin, i) => (bin.multiplier > this.board.bins[best].multiplier ? i : best),
      0,
    );
    if (index === jackpotIndex) return 'jackpot';
    if (Math.abs(index - jackpotIndex) === 1) return 'nearMiss';
    return 'normal';
  }

  private floatingContribution(
    x: number,
    y: number,
    amount: number,
    result: 'jackpot' | 'nearMiss' | 'normal',
  ): void {
    const jackpot = result === 'jackpot';
    const nearMiss = result === 'nearMiss';
    const label = nearMiss ? `KNAPP! +${amount}` : `+${amount}`;
    const t = this.add
      .text(x, y, label, {
        fontSize: jackpot ? '42px' : nearMiss ? '28px' : '22px',
        color: jackpot ? '#fff4a3' : nearMiss ? '#ffd3a6' : '#ffffff',
        fontStyle: 'bold',
        stroke: jackpot ? '#6b3f00' : nearMiss ? '#633000' : '#0b1324',
        strokeThickness: jackpot ? 8 : nearMiss ? 6 : 5,
      })
      .setOrigin(0.5)
      .setDepth(34);

    const burst = this.add
      .circle(
        x,
        y,
        jackpot ? 68 : nearMiss ? 42 : 26,
        jackpot ? DROP_COLORS.jackpotGlow : DROP_COLORS.nearMiss,
        jackpot ? 0.42 : nearMiss ? 0.28 : 0.16,
      )
      .setDepth(29);
    this.tweens.add({
      targets: burst,
      scale: jackpot ? 2.2 : nearMiss ? 1.55 : 1.2,
      alpha: 0,
      duration: jackpot ? 520 : 360,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: t,
      y: y - (jackpot ? 82 : nearMiss ? 56 : 40),
      scale: jackpot ? 1.22 : nearMiss ? 1.1 : 1,
      alpha: 0,
      duration: jackpot ? 860 : nearMiss ? 720 : 600,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });

    if (jackpot) {
      this.cameras.main.flash(180, 255, 210, 90, false, undefined, 0.18);
      this.cameras.main.shake(170, 0.006);
      for (let i = 0; i < 22; i += 1) {
        const sparkle = this.add
          .circle(x, y, Phaser.Math.FloatBetween(2, 5), 0xfff4a3, 0.95)
          .setDepth(33);
        this.tweens.add({
          targets: sparkle,
          x: x + Phaser.Math.Between(-78, 78),
          y: y + Phaser.Math.Between(-72, 38),
          alpha: 0,
          scale: 0.15,
          duration: Phaser.Math.Between(320, 620),
          onComplete: () => sparkle.destroy(),
        });
      }
    } else if (nearMiss) {
      this.cameras.main.shake(90, 0.0025);
    }
  }

  // ---- Phasenende --------------------------------------------------------

  private sweep(): void {
    if (this.finished) return;
    // Off-Screen / feststeckende Bälle einsammeln (Mindestwert), damit die Phase endet.
    for (const go of [...this.active]) {
      if (go.y > GAME_HEIGHT + 40) {
        this.resolver.collectLost(0);
        this.despawn(go);
      }
    }
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.finished) return;
    if (this.releasing && this.allSpawned && this.active.size === 0) this.finish();
  }

  private forceEnd(): void {
    if (this.finished) return;
    for (const go of [...this.active]) {
      this.resolver.collectLost(0);
      this.despawn(go);
    }
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.dripTimer?.remove();
    const balls = this.resolver.total();
    this.sumText.setText(`Σ ${balls}`);
    this.time.delayedCall(500, () => eventBus.emit(GameEvent.DropComplete, { balls }));
  }
}
