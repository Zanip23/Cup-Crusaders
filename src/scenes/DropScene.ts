import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import { TopBar } from '@/ui/TopBar';
import { createButton } from '@/ui/PlaceholderButton';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectBallsFromCombat } from '@/core/state/selectors';
import { BOARD_BASIC } from '@/content/boards/basic';
import { applyGateEffect, DropResolver } from '@/systems/drop/DropResolver';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { StatKey } from '@/core/stats/StatTypes';
import type { BoardDef } from '@/types/content';

// Drop-Phase mit echter Matter.js-Physik (ADR-009, docs/05). Physik-autoritativ:
// Bälle sind Value-Carrying Bodies; Tore/Bins sind Sensoren; der DropResolver
// summiert nur tatsächliche Ergebnisse — kein Steering.

type MatterBody = MatterJS.BodyType & { gameObject?: Phaser.GameObjects.Arc | null };

const BALL_RADIUS = 8;
const DRIP_INTERVAL_MS = 60;
const SPIN_TIMEOUT_MS = 18000; // Timeout-Sicherung: Phase endet garantiert
const CUP_Y = 180;

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

  constructor() {
    // Matter nur in dieser Szene aktiv (docs/01) — per-Scene-Physics-Config.
    super({ key: 'Drop', physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 }, debug: false } } });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.drop);
    this.resetState();

    const gsm = getGsm(this);
    this.board = BOARD_BASIC;
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
    this.registerCollisions();

    // Periodischer End-Check + Off-Screen-Despawn.
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.sweep() });
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
    // Wände + Floor (statisch, nicht-Sensor).
    m.add.rectangle(-10, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { isStatic: true, label: 'wall' });
    m.add.rectangle(GAME_WIDTH + 10, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { isStatic: true, label: 'wall' });
    m.add.rectangle(CENTER_X, GAME_HEIGHT - 30, GAME_WIDTH, 20, { isStatic: true, label: 'wall' });

    // Pegs.
    for (const peg of this.board.pegs) {
      m.add.circle(peg.x, peg.y, peg.radius, {
        isStatic: true,
        restitution: this.board.defaultRestitution,
        label: 'peg',
      });
      this.add.circle(peg.x, peg.y, peg.radius, 0xffffff, 0.65);
    }

    // Tore (Sensoren) + Label.
    this.board.gates.forEach((g, i) => {
      m.add.rectangle(g.x, g.y, g.w, g.h, { isStatic: true, isSensor: true, label: `gate:${i}` });
      this.add.rectangle(g.x, g.y, g.w, g.h, 0x4cc9f0, 0.35).setStrokeStyle(2, 0x4cc9f0);
      this.add.text(g.x, g.y, g.label, { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    });

    // Bins (Sensoren) + Trennwände + Label.
    const binTop = GAME_HEIGHT - 360;
    const sensorY = binTop + 40;
    this.board.bins.forEach((b, i) => {
      const cx = b.x + b.w / 2;
      m.add.rectangle(cx, sensorY, b.w - 6, 70, { isStatic: true, isSensor: true, label: `bin:${i}` });
      const jackpot = b.multiplier >= 10;
      this.add
        .rectangle(cx, sensorY, b.w - 6, 90, jackpot ? 0x7a4dbf : COLORS.shop, jackpot ? 0.5 : 0.6)
        .setStrokeStyle(2, jackpot ? 0xf4c430 : 0xffffff, 0.6);
      this.add
        .text(cx, sensorY, b.label, { fontSize: jackpot ? '30px' : '22px', color: jackpot ? '#f4c430' : COLORS.text, fontStyle: 'bold' })
        .setOrigin(0.5);
      // Trennwand zwischen Bins (physisch), kanalisiert die Bälle.
      if (i > 0) {
        m.add.rectangle(b.x, binTop - 30, 6, 80, { isStatic: true, label: 'wall' });
      }
    });
  }

  private buildCup(): void {
    const body = this.add.rectangle(0, 0, 96, 40, COLORS.accent).setStrokeStyle(3, 0xffffff);
    this.cupAmmoText = this.add
      .text(0, 0, `${this.ammo}`, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.cup = this.add.container(CENTER_X, CUP_Y, [body, this.cupAmmoText]);
    this.cup.setSize(96, 40);
    this.cup.setInteractive({ useHandCursor: true, draggable: true });

    // Drag (horizontal) ...
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number) => {
      if (obj === this.cup) this.cup.x = Phaser.Math.Clamp(dragX, 60, GAME_WIDTH - 60);
    });
    // ... und Tap auf den Becher = ausschütten (Alternative zur Drag-Bedienung).
    this.cup.on('pointerup', () => this.release());
  }

  private buildControls(): void {
    // WCAG 2.5.7: jede Drag-Funktion zusätzlich per Buttons bedienbar.
    createButton(this, CENTER_X, GAME_HEIGHT - 90, 'Ausschütten', () => this.release(), {
      fill: COLORS.accent,
      width: 260,
      height: 64,
    });
    createButton(this, 110, GAME_HEIGHT - 90, '◀', () => this.nudgeCup(-50), { fill: 0x444466, width: 90, height: 64 });
    createButton(this, GAME_WIDTH - 110, GAME_HEIGHT - 90, '▶', () => this.nudgeCup(50), { fill: 0x444466, width: 90, height: 64 });
  }

  private nudgeCup(dx: number): void {
    this.cup.x = Phaser.Math.Clamp(this.cup.x + dx, 60, GAME_WIDTH - 60);
  }

  // ---- Ball-Lebenszyklus -------------------------------------------------

  private release(): void {
    if (this.releasing || this.finished) return;
    if (this.ammo <= 0) {
      this.finish();
      return;
    }
    this.releasing = true;
    this.time.addEvent({ delay: DRIP_INTERVAL_MS, loop: true, callback: () => this.dripOne() });
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
    this.cupAmmoText.setText(`${this.ammo - this.spawned}`);

    const x = this.cup.x + Phaser.Math.Between(-14, 14);
    const ball = this.add.circle(x, CUP_Y + 30, BALL_RADIUS, 0xffffff);
    ball.setData('value', 1);
    ball.setData('gates', new Set<number>());
    this.matter.add.gameObject(ball, {
      shape: { type: 'circle', radius: BALL_RADIUS },
      restitution: this.board.defaultRestitution,
      friction: 0,
      frictionAir: 0.008,
      label: 'ball',
    });
    (ball.body as MatterBody).collisionFilter.group = -1; // Bälle kollidieren nicht untereinander (Perf)
    this.active.add(ball);
  }

  private registerCollisions(): void {
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
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
        if (other.startsWith('gate:')) this.handleGate(go, Number(other.slice(5)));
        else if (other.startsWith('bin:')) this.handleBin(go, Number(other.slice(4)));
      }
    });
  }

  private handleGate(go: Phaser.GameObjects.Arc, index: number): void {
    const passed = go.getData('gates') as Set<number>;
    if (passed.has(index)) return; // pro Ball nur einmal
    passed.add(index);
    const gate = this.board.gates[index];
    const value = applyGateEffect(go.getData('value') as number, gate.effect);
    go.setData('value', value);
    go.setFillStyle(value >= 10 ? 0xf4c430 : value >= 2 ? 0xffa726 : 0xffffff);
    this.tweens.add({ targets: go, scale: 1.5, duration: 90, yoyo: true });
  }

  private handleBin(go: Phaser.GameObjects.Arc, index: number): void {
    if (go.getData('resolved')) return;
    go.setData('resolved', true);
    const bin = this.board.bins[index];
    const contribution = this.resolver.collect(go.getData('value') as number, bin.multiplier);
    this.floatingContribution(go.x, go.y, contribution, bin.multiplier >= 10);
    this.despawn(go);
    this.sumText.setText(`Σ ${this.resolver.total()}`);
    this.checkEnd();
  }

  private despawn(go: Phaser.GameObjects.Arc): void {
    this.active.delete(go);
    if (go.body) this.matter.world.remove(go.body as MatterJS.BodyType);
    go.destroy();
  }

  private floatingContribution(x: number, y: number, amount: number, jackpot: boolean): void {
    const t = this.add
      .text(x, y, `+${amount}`, {
        fontSize: jackpot ? '28px' : '18px',
        color: jackpot ? '#f4c430' : '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 600, onComplete: () => t.destroy() });
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
    const balls = this.resolver.total();
    this.sumText.setText(`Σ ${balls}`);
    this.time.delayedCall(500, () => eventBus.emit(GameEvent.DropComplete, { balls }));
  }
}
