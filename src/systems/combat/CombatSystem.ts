// Rundenbasiertes Auto-Battle (ADR-005, docs/04). Reine Logik — KEIN Phaser.
// Die Szene treibt nur das Timing und animiert die zurückgegebenen Ergebnisse.
//
// Werte kommen ausschließlich aus der StatEngine (eine Zahl-Wahrheit, docs/08).

import { StatKey, MAX_ARMOR_DR } from '@/core/stats/StatTypes';
import type { StatEngine } from '@/core/stats/StatEngine';
import type { EffectSystem } from '@/core/effects/EffectSystem';
import type { Effect } from '@/types/content';
import type { Rng } from '@/core/rng/Rng';
import type { EnemyInstance, HeroTurnResult, EnemyTurnResult, HitResult } from './types';

export class CombatSystem {
  private heroHp: number;
  private readonly heroMaxHp: number;

  constructor(
    private readonly hero: StatEngine,
    private readonly enemies: EnemyInstance[],
    private readonly rng: Rng,
    private readonly effects: EffectSystem,
    startHp: number,
    private readonly heroEffects: Effect[] = [],
  ) {
    this.heroMaxHp = hero.get(StatKey.MaxHp);
    this.heroHp = Math.min(startHp, this.heroMaxHp);
  }

  getHeroHp(): number {
    return this.heroHp;
  }
  getHeroMaxHp(): number {
    return this.heroMaxHp;
  }
  aliveEnemies(): EnemyInstance[] {
    return this.enemies.filter((e) => e.alive);
  }
  isWaveCleared(): boolean {
    return this.aliveEnemies().length === 0;
  }
  isHeroDead(): boolean {
    return this.heroHp <= 0;
  }

  /** Vorderster (held-nächster) lebender Gegner = Index 0 der Lebenden. */
  private frontmost(): EnemyInstance | undefined {
    return this.enemies.find((e) => e.alive);
  }

  private heroAttackCount(): number {
    const projectiles = Math.max(1, Math.round(this.hero.get(StatKey.ProjectileCount)));
    // "Attack Speed" wird im Rundenmodell zu Zusatzangriffen (docs/04) — addiert
    // sich mit ExtraAttack. Ganzzahliger Anteil garantiert, Bruchteil per Wurf.
    const extra = this.hero.get(StatKey.ExtraAttack) + this.hero.get(StatKey.AttackSpeed);
    const frac = extra - Math.floor(extra);
    const bonus = Math.floor(extra) + (frac > 0 && this.rng.next() < frac ? 1 : 0);
    return projectiles + bonus;
  }

  /**
   * Zusätzliche Ziele eines Projektils: Pierce (Durchschlag) + Ricochet (Abpraller)
   * lassen es weitere lebende Gegner treffen (vorderste-zuerst). MVP: voller Schaden.
   */
  private projectileTargets(): EnemyInstance[] {
    const extra =
      Math.round(this.hero.get(StatKey.Pierce)) + Math.round(this.hero.get(StatKey.RicochetBounces));
    return this.aliveEnemies().slice(0, 1 + Math.max(0, extra));
  }

  /** Löst einen einzelnen Treffer auf (Schaden, Ball-Drops, Lifesteal, Tod). */
  private resolveHit(
    target: EnemyInstance,
    damage: number,
    crit: boolean,
    onHitChance: number,
    lifesteal: number,
  ): { result: HitResult; balls: number; heal: number } {
    target.hp -= damage;
    let balls = 0;
    let heal = 0;
    // Ball-Drop bei Treffer (ADR-002), pro aufgelöstem Treffer.
    if (this.rng.next() < onHitChance) balls += 1;
    heal += damage * lifesteal; // Lifesteal (gecappt über die StatEngine)
    const onHit = this.effects.triggerOnHit(this.heroEffects, { rng: this.rng, damage });
    balls += onHit.bonusBalls;
    heal += onHit.heal;

    const killed = target.hp <= 0;
    if (killed) {
      target.alive = false;
      target.hp = 0;
      balls += target.ballDrop; // garantierter Tod-Drop
      balls += this.effects.triggerOnKill(this.heroEffects, { rng: this.rng }).bonusBalls;
    }
    return {
      result: { targetId: target.instanceId, damage, crit, killed, remainingHp: Math.max(0, target.hp), ballsDropped: balls },
      balls,
      heal,
    };
  }

  /** Held-Zug + Effekt-Auflösung (Schritte 1–2 der Runde, docs/04). */
  heroTurn(): HeroTurnResult {
    const hits: HitResult[] = [];
    let healed = 0;
    let balls = 0;

    const dmgBase = this.hero.get(StatKey.AttackDamage);
    const critChance = this.hero.get(StatKey.CritChance);
    const critMult = this.hero.get(StatKey.CritMultiplier);
    const lifesteal = this.hero.get(StatKey.LifestealPct);
    const onHitChance = this.hero.get(StatKey.BallDropOnHitChance);

    const attacks = this.heroAttackCount();
    for (let i = 0; i < attacks; i++) {
      if (!this.frontmost()) break; // Welle bereits leer
      const crit = this.rng.next() < critChance;
      const damage = Math.round(dmgBase * (crit ? critMult : 1));
      // Ein Projektil kann via Pierce/Ricochet mehrere Gegner treffen.
      for (const target of this.projectileTargets()) {
        const { result, balls: b, heal } = this.resolveHit(target, damage, crit, onHitChance, lifesteal);
        hits.push(result);
        balls += b;
        healed += heal;
      }
    }

    healed = Math.round(healed);
    this.heroHp = Math.min(this.heroMaxHp, this.heroHp + healed);
    return { hits, healed, ballsCollected: balls };
  }

  /** Gegner-Zug (Schritt 3 der Runde, docs/04). */
  enemyTurn(): EnemyTurnResult {
    const armor = this.hero.get(StatKey.Armor);
    const dr = Math.min(armor / (100 + armor), MAX_ARMOR_DR);
    const dodge = this.hero.get(StatKey.Dodge);

    const attacks = [];
    for (const e of this.aliveEnemies()) {
      const dodged = this.rng.next() < dodge;
      const dealt = dodged ? 0 : Math.round(e.contactDamage * (1 - dr));
      this.heroHp -= dealt;
      attacks.push({ enemyId: e.instanceId, rawDamage: e.contactDamage, dealt, dodged });
      if (this.heroHp <= 0) {
        this.heroHp = 0;
        break;
      }
    }
    return { attacks, heroHp: this.heroHp, heroDied: this.heroHp <= 0 };
  }
}
