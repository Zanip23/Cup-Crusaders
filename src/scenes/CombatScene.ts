import Phaser from 'phaser';
import { CENTER_X, GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/ui/layout';
import { TopBar } from '@/ui/TopBar';
import { getGsm } from '@/core/registry';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { selectBallsFromCombat } from '@/core/state/selectors';
import { StatKey } from '@/core/stats/StatTypes';
import { EffectSystem } from '@/core/effects/EffectSystem';
import { Rng } from '@/core/rng/Rng';
import { CombatSystem } from '@/systems/combat/CombatSystem';
import { buildHeroStats } from '@/systems/combat/heroBuild';
import { buildWave, isBossWave } from '@/systems/WaveSpawner';
import { WORLD_1 } from '@/content/waves/world-1';
import { FLETCHER } from '@/content/heroes/fletcher';
import type { EnemyInstance, HeroTurnResult, EnemyTurnResult } from '@/systems/combat/types';

// Rundenbasiertes Auto-Battle (ADR-005). Die Szene ist nur View + Timing; die
// gesamte Kampflogik liegt im (testbaren) CombatSystem.

interface EnemyView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  maxHp: number;
  width: number;
}

const STAGE_Y = GAME_HEIGHT * 0.4;
const HERO_X = 120;
const CUP_POS = { x: GAME_WIDTH - 60, y: 60 };

export class CombatScene extends Phaser.Scene {
  private combat!: CombatSystem;
  private heroRect!: Phaser.GameObjects.Rectangle;
  private heroHpBar!: Phaser.GameObjects.Rectangle;
  private heroHpText!: Phaser.GameObjects.Text;
  private heroMaxHp = 1;
  private readonly enemyViews = new Map<string, EnemyView>();
  private finished = false;
  private reducedMotion = false;

  constructor() {
    super('Combat');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.combat);
    this.finished = false;
    this.enemyViews.clear();
    this.reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const gsm = getGsm(this);
    const waveNumber = gsm.getState().run.waveNumber;
    const seed = gsm.getState().run.seed;
    const boss = isBossWave(WORLD_1, waveNumber);

    new TopBar(this, 'KAMPF (Auto-Battler)', (g) => `🏐 ${selectBallsFromCombat(g.getState())}`);

    // Held-StatEngine aus Basis + Meta (Items/Skills) + Run-Upgrades.
    const hero = buildHeroStats(gsm.getState().run, gsm.getState().meta);
    this.heroMaxHp = hero.get(StatKey.MaxHp);

    const enemies = buildWave(WORLD_1, waveNumber);
    // MVP-Recovery: Held startet jede Welle voll geheilt. Persistenter HP-Verschleiß
    // (Lifesteal/Shop-Heals als Erholung) ist ein späterer Balancing-Hebel (M4).
    const startHp = this.heroMaxHp;
    eventBus.emit(GameEvent.HeroHpChanged, { hp: startHp });
    this.combat = new CombatSystem(
      hero,
      enemies,
      new Rng(seed + waveNumber * 1009),
      new EffectSystem(),
      startHp,
      FLETCHER.signature?.effects ?? [],
    );

    this.drawHero();
    this.drawEnemies(enemies, boss);
    this.drawAbilityDeckZone();

    // Erster Held-Zug nach kurzem Vorlauf.
    this.time.delayedCall(600, () => this.runRound());
  }

  // ---- Rendering ---------------------------------------------------------

  private drawHero(): void {
    this.heroRect = this.add
      .rectangle(HERO_X, STAGE_Y, 90, 140, COLORS.hero)
      .setStrokeStyle(3, 0xffffff);
    this.add.text(HERO_X, STAGE_Y + 95, 'HELD', { fontSize: '18px', color: COLORS.text }).setOrigin(0.5);

    // Held-HP-Balken (Region [C]).
    const barY = GAME_HEIGHT * 0.66;
    this.add.rectangle(CENTER_X, barY, 440, 34, 0x000000, 0.4);
    this.heroHpBar = this.add.rectangle(CENTER_X - 218, barY, 436, 26, 0x4caf50).setOrigin(0, 0.5);
    this.heroHpText = this.add
      .text(CENTER_X, barY, '', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.updateHeroHpBar();
  }

  private drawEnemies(enemies: EnemyInstance[], boss: boolean): void {
    if (boss) {
      const e = enemies[0];
      this.add
        .text(CENTER_X + 180, STAGE_Y - 150, 'BOSS', { fontSize: '22px', color: '#f4c430' })
        .setOrigin(0.5);
      this.createEnemyView(e, GAME_WIDTH - 200, STAGE_Y, 160, 200);
      return;
    }
    const startX = 360;
    const step = Math.min(70, (GAME_WIDTH - startX - 40) / Math.max(1, enemies.length - 1 || 1));
    enemies.forEach((e, i) => {
      this.createEnemyView(e, startX + i * step, STAGE_Y, 56, 90);
    });
  }

  private createEnemyView(e: EnemyInstance, x: number, y: number, w: number, h: number): void {
    const body = this.add.rectangle(0, 0, w, h, COLORS.enemy).setStrokeStyle(2, 0xffffff);
    const hpBarBg = this.add.rectangle(0, -h / 2 - 14, w, 8, 0x000000, 0.5);
    const hpBar = this.add.rectangle(-w / 2, -h / 2 - 14, w, 6, 0xe74c3c).setOrigin(0, 0.5);
    const container = this.add.container(x, y, [body, hpBarBg, hpBar]);
    this.enemyViews.set(e.instanceId, { container, body, hpBar, hpBarBg, maxHp: e.maxHp, width: w });
  }

  private drawAbilityDeckZone(): void {
    this.add
      .text(CENTER_X, GAME_HEIGHT - 60, 'Ability-Deck-Zone [D] — reserviert (Post-MVP)', {
        fontSize: '16px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  // ---- Rundentakt --------------------------------------------------------

  private runRound(): void {
    if (this.finished || !this.scene.isActive()) return;

    const result = this.combat.heroTurn();
    this.animateHeroTurn(result);

    this.time.delayedCall(700, () => {
      if (this.finished) return;
      if (this.combat.isWaveCleared()) {
        this.endCombat();
        return;
      }
      const enemyResult = this.combat.enemyTurn();
      this.animateEnemyTurn(enemyResult);
      eventBus.emit(GameEvent.HeroHpChanged, { hp: enemyResult.heroHp });

      this.time.delayedCall(650, () => {
        if (this.finished) return;
        if (this.combat.isHeroDead()) {
          this.finished = true;
          eventBus.emit(GameEvent.PlayerDied, {});
          return;
        }
        this.runRound();
      });
    });
  }

  private endCombat(): void {
    this.finished = true;
    this.time.delayedCall(400, () => eventBus.emit(GameEvent.CombatComplete, {}));
  }

  // ---- Animation / VFX ---------------------------------------------------

  private animateHeroTurn(result: HeroTurnResult): void {
    // Held-Lunge.
    this.tweens.add({ targets: this.heroRect, x: HERO_X + 24, duration: 110, yoyo: true });

    result.hits.forEach((hit, i) => {
      this.time.delayedCall(i * 140, () => {
        const view = this.enemyViews.get(hit.targetId);
        if (view) {
          // Hit-Flash + Knockback.
          view.body.setFillStyle(0xffffff);
          this.time.delayedCall(80, () => view.body.setFillStyle(COLORS.enemy));
          this.tweens.add({ targets: view.container, x: view.container.x + 16, duration: 90, yoyo: true });
          this.setEnemyHpBar(view, hit.remainingHp);
          this.floatingText(
            view.container.x,
            view.container.y - 60,
            `${hit.crit ? '★' : ''}${hit.damage}`,
            hit.crit ? '#f4c430' : '#ffffff',
            hit.crit ? 30 : 22,
          );
          if (hit.killed) this.killEnemyView(hit.targetId);
        }
        if (hit.ballsDropped > 0) {
          this.flyBalls(view?.container.x ?? CENTER_X, view?.container.y ?? STAGE_Y, hit.ballsDropped);
          eventBus.emit(GameEvent.CombatBallsCollected, { amount: hit.ballsDropped });
        }
      });
    });

    if (result.healed > 0) {
      this.floatingText(HERO_X, STAGE_Y - 80, `+${result.healed}`, '#4caf50', 22);
      this.updateHeroHpBarDelayed();
    }
  }

  private setEnemyHpBar(view: EnemyView, remaining: number): void {
    const ratio = Phaser.Math.Clamp(remaining / view.maxHp, 0, 1);
    view.hpBar.width = view.width * ratio;
  }

  private animateEnemyTurn(result: EnemyTurnResult): void {
    result.attacks.forEach((atk, i) => {
      this.time.delayedCall(i * 120, () => {
        if (atk.dodged) {
          this.floatingText(HERO_X, STAGE_Y - 40, 'MISS', '#9a9ab0', 20);
          return;
        }
        this.heroRect.setFillStyle(0xffffff);
        this.time.delayedCall(80, () => this.heroRect.setFillStyle(COLORS.hero));
        if (!this.reducedMotion) this.cameras.main.shake(120, 0.006);
        this.floatingText(HERO_X, STAGE_Y - 40, `-${atk.dealt}`, '#e74c3c', 22);
      });
    });
    this.updateHeroHpBarDelayed();
  }

  private killEnemyView(id: string): void {
    const view = this.enemyViews.get(id);
    if (!view) return;
    this.enemyViews.delete(id);
    this.tweens.add({
      targets: view.container,
      alpha: 0,
      scaleX: 0.4,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => view.container.destroy(),
    });
  }

  private floatingText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, { fontSize: `${size}px`, color, fontStyle: 'bold' })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private flyBalls(x: number, y: number, count: number): void {
    const visual = Math.min(count, 5); // Anzahl visueller Bälle deckeln
    for (let i = 0; i < visual; i++) {
      const ball = this.add.circle(x, y, 7, 0xf4c430).setStrokeStyle(2, 0xffffff);
      this.tweens.add({
        targets: ball,
        x: CUP_POS.x,
        y: CUP_POS.y,
        duration: 450 + i * 60,
        ease: 'Cubic.easeIn',
        onComplete: () => ball.destroy(),
      });
    }
  }

  private updateHeroHpBar(): void {
    const hp = this.combat.getHeroHp();
    const ratio = Phaser.Math.Clamp(hp / this.heroMaxHp, 0, 1);
    this.heroHpBar.width = 436 * ratio;
    this.heroHpBar.setFillStyle(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xf4c430 : 0xe74c3c);
    this.heroHpText.setText(`${Math.ceil(hp)} / ${this.heroMaxHp} HP`);
  }
  private updateHeroHpBarDelayed(): void {
    this.time.delayedCall(60, () => !this.finished && this.scene.isActive() && this.updateHeroHpBar());
  }
}
