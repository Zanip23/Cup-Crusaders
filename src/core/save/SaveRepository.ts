// Persistenz hinter einem Interface (docs/09, ADR-008).
// Default-Impl. = IndexedDB. Austauschbar (z.B. In-Memory für Tests),
// ohne Spielcode anzufassen.

import type { SavedState } from '@/types/state';
import { SAVE_VERSION } from '@/types/state';

export interface SaveRepository {
  load(): Promise<SavedState | null>;
  save(state: SavedState): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'cup-crusaders';
const STORE = 'save';
const KEY = 'state';

/**
 * Migrationspipeline (docs/09). Hebt einen geladenen Blob auf SAVE_VERSION.
 * Da nur IDs/Instances gespeichert werden, sind Migrationen selten nötig.
 */
/** Minimaler Struktur-Guard: schützt vor korrupten/versionslosen Blobs (docs/09). */
function isValidSavedShape(raw: unknown): raw is SavedState {
  if (typeof raw !== 'object' || raw === null) return false;
  const s = raw as Record<string, unknown>;
  if (typeof s.version !== 'number') return false;
  const meta = s.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.currencies !== 'object' || !Array.isArray(meta.inventory)) return false;
  if (typeof s.settings !== 'object' || s.settings === null) return false;
  return true;
}

function migrate(raw: SavedState): SavedState {
  let s = raw;
  // Beispiel-Gerüst: while (s.version < SAVE_VERSION) { ...; s.version++; }
  if (s.version > SAVE_VERSION) {
    // Zukunfts-Version → defensiver Frischstart statt Crash (docs/09).
    throw new Error(`Save-Version ${s.version} ist neuer als unterstützt (${SAVE_VERSION}).`);
  }
  s = { ...s, version: SAVE_VERSION };
  return s;
}

export class IndexedDbSaveRepository implements SaveRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async load(): Promise<SavedState | null> {
    try {
      const db = await this.open();
      const raw = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!raw) return null;
      if (!isValidSavedShape(raw)) {
        console.warn('[SaveRepository] Save strukturell ungültig — starte frisch.');
        return null;
      }
      return migrate(raw);
    } catch (err) {
      // Korrupter/inkompatibler Save → niemals crashen (docs/09).
      console.warn('[SaveRepository] Laden fehlgeschlagen, starte frisch:', err);
      return null;
    }
  }

  async save(state: SavedState): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/** In-Memory-Fallback (z.B. SSR/Tests oder fehlendes IndexedDB). */
export class InMemorySaveRepository implements SaveRepository {
  private data: SavedState | null = null;
  async load(): Promise<SavedState | null> {
    return this.data;
  }
  async save(state: SavedState): Promise<void> {
    this.data = state;
  }
  async clear(): Promise<void> {
    this.data = null;
  }
}

/** Wählt die passende Implementierung je nach Umgebung. */
export function createDefaultSaveRepository(): SaveRepository {
  if (typeof indexedDB !== 'undefined') return new IndexedDbSaveRepository();
  return new InMemorySaveRepository();
}
