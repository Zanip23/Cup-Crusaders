// Single Source of Truth (docs/02). Überlebt Szenenwechsel.
// Mutationen NUR über dispatch(action) → reducer. Lesen über select().
// Persistiert meta+settings (+run als Resume-Slot) via SaveRepository.

import type { GameState, SavedState } from '@/types/state';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import type { SaveRepository } from '@/core/save/SaveRepository';
import { createDefaultSaveRepository } from '@/core/save/SaveRepository';
import type { Action } from './actions';
import { createInitialState, reducer } from './reducers';

const AUTOSAVE_DEBOUNCE_MS = 400;

export class GameStateManager {
  private state: GameState;
  private readonly repo: SaveRepository;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(repo: SaveRepository = createDefaultSaveRepository()) {
    this.repo = repo;
    this.state = createInitialState();
  }

  /** Lädt persistenten State beim Boot (docs/09). Fällt sauber auf Default zurück. */
  async init(): Promise<void> {
    const saved = await this.repo.load();
    if (saved) {
      this.state = {
        version: saved.version,
        meta: saved.meta,
        settings: saved.settings,
        // Resume-Slot: laufenden Run wiederherstellen, sonst frisches Menü.
        run: saved.run ?? createInitialState().run,
      };
    }
  }

  /** Schreibgeschützter Snapshot. Szenen lesen über Selektoren auf diesem Objekt. */
  getState(): Readonly<GameState> {
    return this.state;
  }

  select<T>(selector: (s: GameState) => T): T {
    return selector(this.state);
  }

  /** Einzige Mutations-Schnittstelle. Reiner Reducer → neuer State → Event + Autosave. */
  dispatch(action: Action): void {
    const next = reducer(this.state, action);
    if (next === this.state) return; // No-op (z.B. unbezahlbarer Kauf)
    this.state = next;
    eventBus.emit(GameEvent.StateChanged, {});
    this.scheduleSave();
  }

  private toSaved(): SavedState {
    const { version, meta, settings, run } = this.state;
    // 'menu'/'gameover' nicht als Resume-Slot speichern.
    const resumable = run.phase !== 'menu' && run.phase !== 'gameover' ? run : null;
    return { version, meta, settings, run: resumable };
  }

  /** Debounced Autosave — nicht jeden Frame (IndexedDB-Writes sind async, docs/09). */
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.repo.save(this.toSaved());
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /** Sofort speichern (z.B. bei pagehide/visibilitychange). */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.repo.save(this.toSaved());
  }
}
