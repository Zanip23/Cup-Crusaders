import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH } from '@/ui/layout';
import { TopBar } from '@/ui/TopBar';
import { createButton } from '@/ui/PlaceholderButton';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectBallsFromCombat } from '@/core/state/selectors';
import { resolveBoardForDrop } from '@/content/levels';
import { DropResolver } from '@/systems/drop/DropResolver';
import { pickMysteryEffect } from '@/content/boards/mysteryPools';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { StatKey } from '@/core/stats/StatTypes';
import type { BoardDef, BoardMotionDef } from '@/types/content';
import {
  DROP_COLORS,
  gateColor,
  renderCatcher,
  renderCup,
  renderGate,
  renderMultiplierBar,
  revealMultiplierBarLabel,
  renderPeg,
  renderStageBackground,
  renderWoodBeam,
  renderWoodPost,
} from '@/scenes/drop/DropBoardRenderer';
import { floatingContribution, playGateFx, playStreamParticle } from '@/scenes/drop/DropFx';

// Drop-Phase mit echter Matter.js-Physik (ADR-009, docs/05). Physik-autoritativ:
// Bälle sind Value-Carrying Bodies; Tore/Bins sind Sensoren; der DropResolver
// summiert nur tatsächliche Ergebnisse — kein Steering.

type MatterBody = MatterJS.BodyType & { gameObject?: Phaser.GameObjects.Arc | null };
type MovingBoardElement = {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Components.Transform;
  baseX: number;
  baseY: number;
  motion: BoardMotionDef;
};
type RevealableBoardElement = {
  visual: Phaser.GameObjects.Container;
  revealed: boolean;
};
const BALL_RADIUS = 7;
const DRIP_INTERVAL_MS = 22;
const BALLS_PER_DRIP = 2; // mehrere Bälle pro Tick → dichter Strom (Masse)
const STRONG_GATE_THRESHOLD = 3;
const SPIN_TIMEOUT_MS = 10000; // harte Timeout-Sicherung: Phase endet garantiert
const NO_CATCH_END_MS = 800; // Becher füllt sich seit 0,8s nicht mehr → Phase beenden
const VACUUM_AFTER_MS = 2500; // nach dieser freien Kaskade alle Reste in den Becher saugen
const STUCK_MS = 1300; // Ball bewegt sich ~1,3s kaum → festhängend, entfernen
const STUCK_DIST = 6; // px-Schwelle „hat sich bewegt"
const CUP_Y = 180; // beweglicher Ausschütt-Becher (oben)
const CATCHER_Y = GAME_HEIGHT - 150; // fester Fang-Becher (unten)
const LOST_Y = GAME_HEIGHT - 40; // unter dem Trichter durchgerutscht → verloren
const DEFAULT_CATCHER_W = 160; // Fang-Mund-Breite, falls Board nichts vorgibt
const SPEEDS = [1, 2, 3] as const; // Schnellvorlauf-Stufen

export class DropScene extends Phaser.Scene {
  private board!: BoardDef;
  private resolver!: DropResolver;
  private cup!: Phaser.GameObjects.Container;
  private cupAmmoText!: Phaser.GameObjects.Text;
  private catcher!: Phaser.GameObjects.Container;
  private catcherCountText!: Phaser.GameObjects.Text;
  private catcherWidth = DEFAULT_CATCHER_W;
  private readonly fillBalls: Phaser.GameObjects.Arc[] = [];
  private sumText!: Phaser.GameObjects.Text;
  private topBar!: TopBar;
  private speedButton?: Phaser.GameObjects.Container;
  private readonly revealableBoardElements = new Map<string, RevealableBoardElement>();
  private speedIndex = 0;
  private lastFxTotal = 0; // gedrosseltes Catch-FX: zeigt „+N" pro Burst
  private lastFxAt = 0;
  private lastCatchAt = 0; // letzter Becher-Treffer — Phase endet, wenn er aufhört
  private allSpawnedAt = 0; // Zeitpunkt, ab dem alle Bälle ausgeschüttet sind
  private ammo = 0;
  private spawned = 0;
  private releasing = false;
  private allSpawned = false;
  private finished = false;
  private readonly active = new Set<Phaser.GameObjects.Arc>();
  private dripTimer?: Phaser.Time.TimerEvent;
  private cupHintText?: Phaser.GameObjects.Text;
  private cupPointerStartX = 0;
  private cupDragStartX = 0;
  private activeCupPointerId?: number;
  private cupDisplayedAmmo = 0;
  private collisionHandler?: (e: Phaser.Physics.Matter.Events.CollisionStartEvent) => void;
  private readonly movingBoardElements: MovingBoardElement[] = [];

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
    const run = gsm.getState().run;
    this.board = resolveBoardForDrop(run.levelId, run.waveNumber, run.seed);
    // Munition = Kampf-Bälle + StartingBalls (Upgrade/Item, additiv vor Drop-Start).
    const startingBalls = buildHeroStats(gsm.getState().run, gsm.getState().meta).get(
      StatKey.StartingBalls,
    );
    this.ammo = selectBallsFromCombat(gsm.getState()) + Math.round(startingBalls);
    this.resolver = new DropResolver();

    // Top-Bar-Ballzähler zeigt LIVE die Bälle im Spiel (wächst beim Multiplizieren).
    this.topBar = new TopBar(this, 'DROP · Becher füllen', () => `🏐 ${this.displayBallCount()}`);

    this.sumText = this.add
      .text(CENTER_X, 130, 'Σ 0', { fontSize: '26px', color: '#f4c430', fontStyle: 'bold' })
      .setOrigin(0.5);

    this.buildBoard();
    this.buildCatcher();
    this.buildCup();
    this.buildControls();
    this.buildSpeedButton();
    this.setupKeyboard();
    this.registerCollisions();

    // Periodischer End-Check + Off-Screen-Despawn (häufig genug fürs Idle-Ende).
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.sweep() });

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
    this.speedIndex = 0;
    this.lastFxTotal = 0;
    this.lastFxAt = 0;
    this.lastCatchAt = 0;
    this.allSpawnedAt = 0;
    this.active.clear();
    this.fillBalls.length = 0;
    this.movingBoardElements.length = 0;
  }

  // Phaser-Frame-Loop: Live-Ballzähler oben aktualisieren (Bälle im Spiel).
  update(): void {
    this.updateBoardMotion();
    if (this.finished || !this.releasing) return;
    this.topBar.refresh();
  }

  // Oben angezeigte Ballzahl: vor dem Start die Munition, danach die Bälle im Spiel.
  private displayBallCount(): number {
    return this.releasing ? this.active.size : this.ammo;
  }

  // ---- Schnellvorlauf -----------------------------------------------------

  private buildSpeedButton(): void {
    // Zeit-Skalen auf 1 zurücksetzen (Szene wird pro Welle neu gestartet).
    this.matter.world.engine.timing.timeScale = 1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.speedButton = createButton(
      this,
      GAME_WIDTH - 70,
      150,
      this.speedLabel(),
      () => this.cycleSpeed(),
      { fill: 0x24344f, width: 108, height: 46 },
    );
    this.speedButton.setAlpha(0.92).setDepth(40);
  }

  private speedLabel(): string {
    return `x${SPEEDS[this.speedIndex]} ▶▶`;
  }

  private cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[this.speedIndex];
    // Physik, Timer und Tweens dieser Szene gleichermaßen beschleunigen.
    this.matter.world.engine.timing.timeScale = speed;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
    const label = this.speedButton?.getAt(1) as Phaser.GameObjects.Text | undefined;
    label?.setText(this.speedLabel());
  }

  // ---- Board-Aufbau ------------------------------------------------------

  private buildBoard(): void {
    const m = this.matter;
    renderStageBackground(this);

    // Seitenwände (statisch). KEIN Boden — verfehlte Bälle fallen unten heraus
    // und werden vom sweep() als „verloren" verbucht, damit die Phase endet.
    const wallThickness = 28;
    m.add.rectangle(wallThickness / 2, GAME_HEIGHT / 2, wallThickness, GAME_HEIGHT, {
      isStatic: true,
      label: 'wall',
    });
    m.add.rectangle(GAME_WIDTH - wallThickness / 2, GAME_HEIGHT / 2, wallThickness, GAME_HEIGHT, {
      isStatic: true,
      label: 'wall',
    });
    renderWoodBeam(
      this,
      wallThickness / 2,
      GAME_HEIGHT / 2,
      GAME_HEIGHT + 28,
      wallThickness,
      Math.PI / 2,
      12,
    );
    renderWoodBeam(
      this,
      GAME_WIDTH - wallThickness / 2,
      GAME_HEIGHT / 2,
      GAME_HEIGHT + 28,
      wallThickness,
      Math.PI / 2,
      12,
    );

    // Pegs als glänzende Pins.
    for (const peg of this.board.pegs) {
      m.add.circle(peg.x, peg.y, peg.radius, {
        isStatic: true,
        restitution: this.board.defaultRestitution,
        label: 'peg',
      });
      renderPeg(this, peg.x, peg.y, peg.radius);
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
      renderWoodBeam(this, ramp.x, ramp.y, ramp.w, Math.max(30, ramp.h), angle, 13);
    });

    this.board.blockers?.forEach((blocker) => {
      const angle = Phaser.Math.DegToRad(blocker.angle ?? 0);
      const body = m.add.rectangle(blocker.x, blocker.y, blocker.w, blocker.h, {
        isStatic: true,
        angle,
        restitution: this.board.defaultRestitution * 0.85,
        label: 'blocker',
      });
      const visual = renderWoodPost(this, blocker.x, blocker.y, blocker.h, blocker.w, angle);
      this.trackBoardMotion(body, visual, blocker.x, blocker.y, blocker.motion);
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
      const body = m.add.rectangle(platform.x, platform.y, platform.w, platform.h, {
        isStatic: true,
        isSensor: true,
        angle,
        label: `platform:${i}`,
      });
      const visual = renderMultiplierBar(
        this,
        platform.x,
        platform.y,
        platform.w,
        platform.h,
        platform.label,
        platform.color ?? gateColor(platform.label),
      );
      this.trackBoardMotion(body, visual, platform.x, platform.y, platform.motion);
      this.trackRevealableBoardElement(`platform:${i}`, visual, platform.label);
    });

    this.board.boosters?.forEach((booster, i) => {
      const angle = Phaser.Math.DegToRad(booster.angle ?? 0);
      const body = m.add.rectangle(booster.x, booster.y, booster.w, booster.h, {
        isStatic: true,
        isSensor: true,
        angle,
        label: `booster:${i}`,
      });
      const visual = renderMultiplierBar(
        this,
        booster.x,
        booster.y,
        booster.w,
        booster.h,
        booster.label,
        booster.color ?? gateColor(booster.label),
      );
      this.trackBoardMotion(body, visual, booster.x, booster.y, booster.motion);
      this.trackRevealableBoardElement(`booster:${i}`, visual, booster.label);
    });

    // Tore (Sensoren) als breite, farbige Multiplikator-Balken.
    this.board.gates.forEach((g, i) => {
      const body = m.add.rectangle(g.x, g.y, g.w, g.h, {
        isStatic: true,
        isSensor: true,
        label: `gate:${i}`,
      });
      const visual = renderGate(this, g);
      this.trackBoardMotion(body, visual, g.x, g.y, g.motion);
      this.trackRevealableBoardElement(`gate:${i}`, visual, g.label);
    });
  }

  private trackRevealableBoardElement(
    id: string,
    visual: Phaser.GameObjects.Container,
    label: string,
  ): void {
    if (!label.includes('?')) return;
    this.revealableBoardElements.set(id, { visual, revealed: false });
  }

  private trackBoardMotion(
    body: MatterJS.BodyType,
    visual: Phaser.GameObjects.Components.Transform,
    baseX: number,
    baseY: number,
    motion?: BoardMotionDef,
  ): void {
    if (!motion) return;
    this.movingBoardElements.push({ body, visual, baseX, baseY, motion });
  }

  private updateBoardMotion(): void {
    if (this.movingBoardElements.length === 0) return;
    for (const element of this.movingBoardElements) {
      const next = this.resolveMotionPosition(element.baseX, element.baseY, element.motion);
      this.matter.body.setPosition(element.body, next);
      element.visual.setPosition(next.x, next.y);
    }
  }

  private resolveMotionPosition(
    baseX: number,
    baseY: number,
    motion: BoardMotionDef,
  ): Phaser.Types.Math.Vector2Like {
    const duration = Math.max(1, motion.durationMs);
    const phaseMs = this.time.now + (motion.phaseOffsetMs ?? 0);
    const t = Phaser.Math.Wrap(phaseMs, 0, duration) / duration;

    if (motion.type === 'horizontal') {
      const dx = Math.sin(t * Math.PI * 2) * motion.amplitude;
      return { x: baseX + dx, y: baseY };
    }

    if (motion.type === 'vertical') {
      const dy = Math.sin(t * Math.PI * 2) * motion.amplitude;
      return { x: baseX, y: baseY + dy };
    }

    if (motion.type === 'pingpong') {
      const normalized = t < 0.5 ? t * 2 : (1 - t) * 2;
      const dx = Phaser.Math.Linear(-motion.amplitude, motion.amplitude, normalized);
      return { x: baseX + dx, y: baseY };
    }

    // Pulse ist im Schema reserviert, wird aber erst später als reiner visueller
    // Effekt umgesetzt. Bis dahin bleibt die Physik-Position unverändert.
    return { x: baseX, y: baseY };
  }

  // Solide Rampe aus zwei Endpunkten (Länge/Winkel berechnet) + Holz-Optik.
  private addRamp(x1: number, y1: number, x2: number, y2: number): void {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    this.matter.add.rectangle(cx, cy, length, 42, {
      isStatic: true,
      angle,
      restitution: 0.18,
      friction: 0,
      label: 'wall',
    });
    renderWoodBeam(this, cx, cy, length, 42, angle, 14);
  }

  // Fester Fang-Becher unten + TRICHTER: zwei Rampen leiten alle Bälle in den
  // Becher (Treffer = +1). Was unten durchrutscht, ist verloren (Sicherheit).
  private buildCatcher(): void {
    this.catcherWidth = this.board.catcherWidth ?? DEFAULT_CATCHER_W;
    const m = this.matter;

    // Trichter: Lücke knapp schmaler als der Sensor → kein Ball geht daneben.
    const gapHalf = this.catcherWidth / 2 - 8;
    const innerY = CATCHER_Y - 34;
    const outerY = CATCHER_Y - 168;
    this.addRamp(14, outerY, CENTER_X - gapHalf, innerY);
    this.addRamp(GAME_WIDTH - 14, outerY, CENTER_X + gapHalf, innerY);

    const catcherVisuals = renderCatcher(this, CENTER_X, CATCHER_Y, this.catcherWidth);
    this.catcher = catcherVisuals.cup;
    this.catcherCountText = catcherVisuals.ammoText;
    this.catcherCountText.setText('0');

    // Hoher Sensor über die volle Öffnungsbreite = Becher-Volumen. Höhe statt nur
    // Mund-Linie verhindert, dass schnelle Bälle in einem Physik-Step „durchtunneln".
    m.add.rectangle(CENTER_X, CATCHER_Y, this.catcherWidth, 96, {
      isStatic: true,
      isSensor: true,
      label: 'catcher',
    });
  }

  private buildCup(): void {
    this.cupDisplayedAmmo = this.ammo;
    const cupVisuals = renderCup(this, CENTER_X, CUP_Y, this.ammo);
    this.cup = cupVisuals.cup;
    this.cupAmmoText = cupVisuals.ammoText;
    this.cup.setInteractive({ useHandCursor: true });

    // Virtueller Ein-Achsen-Joystick: Der Spieler kann an beliebiger Stelle
    // drücken und horizontal ziehen. Der Becher folgt der Finger-Bewegung relativ
    // zur Startposition; beim Loslassen startet immer der Drop.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.releasing || this.finished || this.activeCupPointerId !== undefined) return;
      this.activeCupPointerId = pointer.id;
      this.cupPointerStartX = pointer.x;
      this.cupDragStartX = this.cup.x;
      this.tweens.add({
        targets: this.cup,
        scaleX: 1.04,
        scaleY: 0.97,
        duration: 90,
        ease: 'Sine.easeOut',
      });
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.releasing || this.finished || pointer.id !== this.activeCupPointerId) return;
      const nextX = Phaser.Math.Clamp(
        this.cupDragStartX + pointer.x - this.cupPointerStartX,
        70,
        GAME_WIDTH - 70,
      );
      const delta = nextX - this.cup.x;
      this.cup.x = nextX;
      this.cup.rotation = Phaser.Math.Clamp(delta * 0.012, -0.16, 0.16);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.activeCupPointerId) return;
      this.activeCupPointerId = undefined;
      this.settleCupTilt();
      this.release();
    });
  }

  private buildControls(): void {
    this.cupHintText = this.add
      .text(CENTER_X, CUP_Y + 66, 'Überall ziehen • Loslassen zum Start', {
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
    // Mehrere Bälle pro Tick → dichter Strom (Masse-Gefühl wie Referenz).
    for (let i = 0; i < BALLS_PER_DRIP; i += 1) {
      if (this.active.size >= this.board.maxConcurrentBalls) return; // Performance-Cap
      if (this.spawned >= this.ammo) {
        if (!this.allSpawned) this.allSpawnedAt = this.time.now;
        this.allSpawned = true;
        return;
      }
      this.spawned += 1;
      this.updateCupAmmo(this.ammo - this.spawned);
      this.spawnBallFromCup();
    }
  }

  // Gemeinsame Ball-Initialisierung: Wert, durchlaufene Zonen, Bewegungs-Tracking.
  private initBall(
    ball: Phaser.GameObjects.Arc,
    x: number,
    y: number,
    inheritedGates?: Set<string>,
  ): void {
    ball.setData('value', 1);
    ball.setData('gates', new Set(inheritedGates ?? []));
    ball.setData('mx', x);
    ball.setData('my', y);
    ball.setData('mAt', this.time.now);
  }

  private spawnBallFromCup(): void {
    const x = this.cup.x + Phaser.Math.Between(-22, 22);
    const y = CUP_Y + Phaser.Math.Between(18, 34);
    const ball = this.add.circle(x, y, BALL_RADIUS, 0xffffff);
    this.initBall(ball, x, y);
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
    playStreamParticle(this, x, y);
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
        else if (other === 'catcher') this.handleCatch(go);
      }
    };
    this.matter.world.on('collisionstart', this.collisionHandler);
  }

  // Balken multiplizieren die ANZAHL der Bälle (nicht den Wert): 1 Ball → F Bälle.
  // Jeder Ball ist 1 wert; gefangene Bälle = Endsumme (zählbar, ADR-009).
  private handleGate(
    go: Phaser.GameObjects.Arc,
    id: string,
    effect: BoardDef['gates'][number]['effect'] | undefined,
  ): void {
    if (!effect) return;
    const passed = go.getData('gates') as Set<string>;
    if (passed.has(id)) return; // pro Ball nur einmal pro Zone
    passed.add(id);
    this.popBall(go);

    if (effect.type === 'gateMystery') {
      const mystery = pickMysteryEffect(effect, () => Phaser.Math.FloatBetween(0, 1));
      const revealedLabel = this.revealedLabelForMystery(mystery);
      this.revealMysteryElement(id, revealedLabel);
      playGateFx(this, go.x, go.y, mystery.label, Boolean(mystery.strong));

      if (mystery.kind === 'loseBall') {
        this.resolver.collectLost(0);
        this.despawn(go);
        this.checkEnd();
        return;
      }

      this.applyGateReward(go, passed, mystery.effect, false);
      return;
    }

    this.applyGateReward(go, passed, effect, true);
  }

  private revealMysteryElement(id: string, label: string): void {
    const element = this.revealableBoardElements.get(id);
    if (!element || element.revealed) return;
    revealMultiplierBarLabel(this, element.visual, label);
    element.revealed = true;
  }

  private revealedLabelForMystery(mystery: ReturnType<typeof pickMysteryEffect>): string {
    if (mystery.kind === 'loseBall') return '0';
    if (mystery.effect.type === 'gateMultiply') {
      return `X${Math.max(1, Math.floor(Number(mystery.effect.params.factor ?? 1)))}`;
    }
    if (mystery.effect.type === 'gateAdd') return 'Bonus';
    return '???';
  }

  private applyGateReward(
    go: Phaser.GameObjects.Arc,
    passed: Set<string>,
    effect: BoardDef['gates'][number]['effect'],
    showFx: boolean,
  ): void {
    if (effect.type === 'gateMultiply') {
      const factor = Math.max(1, Math.floor(Number(effect.params.factor ?? 1)));
      const bonusCount = factor - 1;
      this.spawnBonusBalls(go, bonusCount, passed);
      if (showFx) playGateFx(this, go.x, go.y, `x${factor}!`, factor >= STRONG_GATE_THRESHOLD);
      return;
    }

    if (effect.type === 'gateAdd') {
      const amount = Math.max(0, Math.floor(Number(effect.params.amount ?? 0)));
      const bonusCount = amount;
      this.spawnBonusBalls(go, bonusCount, passed);
      if (showFx) playGateFx(this, go.x, go.y, `+${bonusCount}!`, true);
    }
  }

  private spawnBonusBalls(
    sourceBall: Phaser.GameObjects.Arc,
    count: number,
    inheritedGates?: Set<string>,
  ): void {
    const availableSlots = this.board.maxConcurrentBalls - this.active.size;
    const spawnCount = Math.max(0, Math.min(count, availableSlots));
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
      const ball = this.add.circle(x, y, BALL_RADIUS, 0xffffff).setDepth(sourceBall.depth);
      this.initBall(ball, x, y, inheritedGates);
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
    }
  }

  // Kurzer „Pop" beim Passieren eines Balkens (alle Bälle bleiben weiß wie Referenz).
  private popBall(go: Phaser.GameObjects.Arc): void {
    this.tweens.add({ targets: go, scale: 1.5, duration: 80, yoyo: true });
  }

  // Boost-Balken: katapultiert den Ball EINMAL nach oben (zweite Chance an den
  // Multiplikatoren) und verdoppelt die Anzahl. Bei erneuter Berührung fällt der
  // Ball durch (Sensor) — wie in der Referenz.
  private handleBooster(go: Phaser.GameObjects.Arc, body: MatterBody, index: number): void {
    const booster = this.board.boosters?.[index];
    if (!booster) return;
    const id = `booster:${index}`;
    const passed = go.getData('gates') as Set<string>;
    if (passed.has(id)) return; // schon gesprungen → durchfallen
    this.handleGate(go, id, booster.effect); // markiert id + verdoppelt die Anzahl

    // WICHTIG: Geschwindigkeit über die Matter-API setzen (passt positionPrev an),
    // sonst überschreibt der nächste Physik-Step die direkte velocity-Zuweisung.
    this.setBallVelocity(
      go,
      body.velocity.x + Phaser.Math.FloatBetween(-2.2, 2.2),
      -Phaser.Math.FloatBetween(8, 10),
    );
    this.tweens.add({
      targets: go,
      alpha: 0.5,
      scaleX: 1.4,
      scaleY: 0.7,
      duration: 70,
      yoyo: true,
    });
  }

  private setBallVelocity(go: Phaser.GameObjects.Arc, vx: number, vy: number): void {
    (go as unknown as Phaser.Physics.Matter.Components.Velocity).setVelocity(vx, vy);
  }

  // Ball im Fang-Becher gelandet: +1 verbuchen. Bei dichtem Strom landen hunderte
  // Bälle/Sek. — Zähler immer aktualisieren, FX aber drosseln (sonst Float-Spam).
  private handleCatch(go: Phaser.GameObjects.Arc): void {
    if (go.getData('resolved')) return;
    go.setData('resolved', true);
    const x = go.x;
    const y = go.y;
    this.resolver.collect(go.getData('value') as number, 1);
    this.lastCatchAt = this.time.now;
    this.despawn(go);
    this.addFillBall();

    const total = this.resolver.total();
    this.catcherCountText.setText(`${total}`);
    this.sumText.setText(`Σ ${total}`);

    // Gedrosseltes Burst-FX: „+N" für die seit dem letzten FX gefangenen Bälle.
    const now = this.time.now;
    if (now - this.lastFxAt > 130) {
      const gained = total - this.lastFxTotal;
      this.lastFxTotal = total;
      this.lastFxAt = now;
      if (gained > 0)
        floatingContribution(this, x, y - 40, gained, gained >= 8 ? 'good' : 'normal');
      this.bumpCatcher();
      this.playOptionalSound('drop-catch');
    }
    this.checkEnd();
  }

  // Sichtbares Füllen: kleine Bälle stapeln sich im Becher (Höhe steigt mit Anzahl).
  private addFillBall(): void {
    const level = Math.min(1, this.fillBalls.length / 26);
    const halfBottom = this.catcherWidth * 0.32;
    const bx = Phaser.Math.Between(-halfBottom, halfBottom);
    const by = 22 - level * 30 + Phaser.Math.Between(-2, 2);
    const dot = this.add.circle(bx, by, BALL_RADIUS - 1, 0xffffff, 0.96);
    this.catcher.add(dot);
    this.catcher.bringToTop(this.catcherCountText); // Zahl bleibt obenauf
    this.fillBalls.push(dot);
    if (this.fillBalls.length > 28) this.fillBalls.shift()?.destroy();
  }

  // Kleiner „Auffang"-Impuls auf den Catcher als Feedback.
  private bumpCatcher(): void {
    this.tweens.killTweensOf(this.catcher);
    this.tweens.add({
      targets: this.catcher,
      scaleX: 1.06,
      scaleY: 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private despawn(go: Phaser.GameObjects.Arc): void {
    this.active.delete(go);
    // WICHTIG: Laufende Tweens (z. B. der Scale-„Pop" aus flashBallValue) zuerst
    // stoppen. Bälle sind Matter-Bodies — ein Scale-Tween skaliert pro Frame auch
    // den Physik-Body. Wird der Body hier entfernt, während der Tween noch läuft,
    // greift Phasers Matter-Transform im nächsten Frame auf den fehlenden Body zu
    // (Body.scale → body.position) und die Render-Loop stirbt (weißer/leerer Canvas).
    this.tweens.killTweensOf(go);
    if (go.body) this.matter.world.remove(go.body as MatterJS.BodyType);
    go.destroy();
  }

  private playOptionalSound(key: string): void {
    if (this.cache.audio.exists(key)) this.sound.play(key);
  }

  // ---- Phasenende --------------------------------------------------------

  private sweep(): void {
    if (this.finished) return;
    const now = this.time.now;
    // Sog in den Becher: greift, sobald nur noch wenige Nachzügler übrig sind ODER
    // die freie Kaskade lang genug lief (VACUUM_AFTER_MS). So bleibt der Drop kurz,
    // ohne den Masse-Effekt der ersten Sekunden zu verlieren.
    const vacuum =
      this.allSpawned &&
      (this.active.size <= 8 || this.time.now - this.allSpawnedAt > VACUUM_AFTER_MS);
    if (vacuum) {
      for (const go of this.active) {
        this.setBallVelocity(go, (CENTER_X - go.x) * 0.06, 16);
      }
    }
    // Becher füllt sich nicht mehr: Ist alles ausgeschüttet, hat der Becher schon
    // Bälle (≥1 Treffer) und kam seit NO_CATCH_END_MS keiner mehr dazu → Phase
    // beenden. Genau das Gefühl „alle Bälle sind drin, jetzt weiter".
    if (this.allSpawned && this.resolver.total() > 0 && now - this.lastCatchAt > NO_CATCH_END_MS) {
      this.forceEnd();
      return;
    }
    for (const go of [...this.active]) {
      // Verfehlt (unter der Lost-Linie) → verloren.
      if (go.y > LOST_Y) {
        this.resolver.collectLost(0);
        this.despawn(go);
        continue;
      }
      // Festhängend? Bewegt sich der Ball seit STUCK_MS um < STUCK_DIST, gilt er als
      // verklemmt (auf einem Pfosten/in einer Ecke) und wird entfernt — so endet die
      // Phase zügig, statt auf den harten Timeout zu warten.
      const moved = Math.hypot(
        go.x - (go.getData('mx') as number),
        go.y - (go.getData('my') as number),
      );
      if (moved > STUCK_DIST) {
        go.setData('mx', go.x);
        go.setData('my', go.y);
        go.setData('mAt', now);
      } else if (this.allSpawned && now - (go.getData('mAt') as number) > STUCK_MS) {
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
    this.showDropSummary(balls, () => eventBus.emit(GameEvent.DropComplete, { balls }));
  }

  private showDropSummary(total: number, onComplete: () => void): void {
    this.playOptionalSound('drop-summary');
    this.sumText.setText('Σ 0');
    const overlay = this.add
      .rectangle(CENTER_X, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02040a, 0.42)
      .setDepth(80);
    const panel = this.add
      .rectangle(CENTER_X, GAME_HEIGHT / 2, 330, 150, 0x101f35, 0.94)
      .setStrokeStyle(4, DROP_COLORS.glow, 0.86)
      .setDepth(81);
    const title = this.add
      .text(CENTER_X, GAME_HEIGHT / 2 - 42, 'Drop-Auswertung', {
        fontSize: '24px',
        color: '#dff7ff',
        fontStyle: 'bold',
        stroke: '#06111f',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(82);
    const summary = this.add
      .text(CENTER_X, GAME_HEIGHT / 2 + 14, 'Gesamt: 0', {
        fontSize: '38px',
        color: '#fff4a3',
        fontStyle: 'bold',
        stroke: '#6b3f00',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(82);

    const counter = { value: 0 };
    this.tweens.add({
      targets: [overlay, panel, title, summary],
      alpha: { from: 0, to: 1 },
      duration: 180,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: panel,
      scaleX: { from: 0.82, to: 1 },
      scaleY: { from: 0.82, to: 1 },
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: counter,
      value: total,
      duration: Phaser.Math.Clamp(total * 14, 300, 650),
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const current = Math.round(counter.value);
        this.sumText.setText(`Σ ${current}`);
        summary.setText(`Gesamt: ${current}`);
      },
      onComplete: () => {
        this.sumText.setText(`Σ ${total}`);
        summary.setText(`Gesamt: ${total}`);
        this.time.delayedCall(250, onComplete);
      },
    });
  }
}
