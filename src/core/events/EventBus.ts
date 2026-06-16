// Schlanker, typisierter Event-Emitter (docs/02 §EventBus).
// Bewusst OHNE Phaser-Abhängigkeit, damit core/ vollständig Phaser-entkoppelt
// und in Node/Vitest testbar bleibt (docs/02 §Test-Strategie). Global instanziiert.

import type { GameEvent, GameEventPayloads } from './GameEvents';

type Handler<E extends GameEvent> = (payload: GameEventPayloads[E]) => void;

interface Listener {
  fn: (payload: unknown) => void;
  ctx?: unknown;
  once: boolean;
}

class TypedEventBus {
  private readonly listeners = new Map<GameEvent, Listener[]>();

  emit<E extends GameEvent>(event: E, payload: GameEventPayloads[E]): void {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return;
    // Über eine Kopie iterieren: Handler dürfen während emit ab-/anmelden.
    for (const l of [...list]) {
      l.fn.call(l.ctx, payload);
      if (l.once) this.remove(event, l);
    }
  }

  on<E extends GameEvent>(event: E, fn: Handler<E>, ctx?: unknown): void {
    this.add(event, fn as Listener['fn'], ctx, false);
  }

  once<E extends GameEvent>(event: E, fn: Handler<E>, ctx?: unknown): void {
    this.add(event, fn as Listener['fn'], ctx, true);
  }

  off<E extends GameEvent>(event: E, fn?: Handler<E>, ctx?: unknown): void {
    if (!fn) {
      this.listeners.delete(event);
      return;
    }
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(
      event,
      list.filter((l) => !(l.fn === (fn as Listener['fn']) && (ctx === undefined || l.ctx === ctx))),
    );
  }

  /** Entfernt alle Listener (v.a. für Tests). */
  removeAll(): void {
    this.listeners.clear();
  }

  private add(event: GameEvent, fn: Listener['fn'], ctx: unknown, once: boolean): void {
    const list = this.listeners.get(event) ?? [];
    list.push({ fn, ctx, once });
    this.listeners.set(event, list);
  }

  private remove(event: GameEvent, target: Listener): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(target);
    if (idx >= 0) list.splice(idx, 1);
  }
}

/** Globaler Singleton-EventBus. */
export const eventBus = new TypedEventBus();
export { TypedEventBus };
