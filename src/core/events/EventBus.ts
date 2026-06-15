// Dünner, typisierter Wrapper um Phasers EventEmitter (docs/02).
// Global instanziiert; entkoppelt die Phasen voneinander.

import Phaser from 'phaser';
import type { GameEvent, GameEventPayloads } from './GameEvents';

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  emit<E extends GameEvent>(event: E, payload: GameEventPayloads[E]): void {
    this.emitter.emit(event, payload);
  }

  on<E extends GameEvent>(event: E, fn: (payload: GameEventPayloads[E]) => void, ctx?: unknown): void {
    this.emitter.on(event, fn, ctx);
  }

  once<E extends GameEvent>(
    event: E,
    fn: (payload: GameEventPayloads[E]) => void,
    ctx?: unknown,
  ): void {
    this.emitter.once(event, fn, ctx);
  }

  off<E extends GameEvent>(event: E, fn?: (payload: GameEventPayloads[E]) => void, ctx?: unknown): void {
    this.emitter.off(event, fn, ctx);
  }
}

/** Globaler Singleton-EventBus. */
export const eventBus = new TypedEventBus();
export type { TypedEventBus };
