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
    const extra = this.hero.get(StatKey.ExtraAttack); // z.B. 0.6 → 60 % Zusatzangriff
    const frac = extra - Math.floor(extra);
    const bonus = Math.floor(extra) + (frac > 0 && this.rng.next() < frac ? 1 : 0);
    return projectiles + bonus;
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
      const target = this.frontmost();
      if (!target) break; // Welle bereits leer

      const crit = this.rng.next() < critChance;
      const damage = Math.round(dmgBase * (crit ? critMult : 1));
      target.hp -= damage;

      let ballsThisHit = 0;
      // Ball-Drop bei Treffer (ADR-002 — als onHit modelliert, hier stat-getrieben).
      if (this.rng.next() < onHitChance) ballsThisHit += 1;
      // Lifesteal (gecappt über die StatEngine).
      healed += damage * lifesteal;
      // Content-onHit-Effekte des Helden (Signature/Items).
      const onHit = this.effects.triggerOnHit(this.heroEffects, { rng: this.rng, damage });
      ballsThisHit += onHit.bonusBalls;
      healed += onHit.heal;

      const killed = target.hp <= 0;
      if (killed) {
        target.alive = false;
        target.hp = 0;
        ballsThisHit += target.ballDrop; // garantierter Tod-Drop
        const onKill = this.effects.triggerOnKill(this.heroEffects, { rng: this.rng });
        ballsThisHit += onKill.bonusBalls;
      }

      balls += ballsThisHit;
      hits.push({
        targetId: target.instanceId,
        damage,
        crit,
        killed,
        remainingHp: Math.max(0, target.hp),
        ballsDropped: ballsThisHit,
      });
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
