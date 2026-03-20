import { v4 as uuidv4 } from 'uuid';
import type { SaveData } from '@/types/game';
import { DEFAULT_SAVE } from '@/types/game';
import { EventBus } from './EventBus';
import { GameEvents } from '@/types/events';

const USER_ID_KEY = 'circuit_grove_user_id';
const EMERGENCY_KEY = 'circuit_grove_emergency_save';
const CURRENT_VERSION = 2;

type Migration = (old: Record<string, unknown>) => SaveData;

const MIGRATIONS: Map<number, Migration> = new Map([
  [
    1,
    (old) => ({
      ...(old as Partial<SaveData>),
      version: 2,
      deathsPerAnimal: (old['deathsPerAnimal'] as Record<string, number>) ?? {},
      totalRunsStarted: (old['totalRunsStarted'] as number) ?? 0,
      totalRunsCompleted: (old['totalRunsCompleted'] as number) ?? 0,
      lastSavedAt: new Date().toISOString(),
    } as SaveData),
  ],
]);

/**
 * Persistent save system backed by Vercel Postgres (via /api/save).
 * Falls back to localStorage if the network request fails.
 */
class SaveServiceClass {
  private userId!: string;
  private currentSave: SaveData | null = null;

  init(): void {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(USER_ID_KEY, id);
    }
    this.userId = id;
  }

  getUserId(): string {
    return this.userId;
  }

  async load(): Promise<SaveData> {
    try {
      const res = await fetch(`/api/save?userId=${encodeURIComponent(this.userId)}`);

      if (res.status === 404) {
        // New player — initialise fresh save; fire-and-forget the remote write
        const fresh = this.createFresh();
        this.currentSave = fresh;
        void this.save(fresh); // don't await — let it fail silently if server is down
        return fresh;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json() as { saveData: Record<string, unknown> };
      const migrated = this.migrate(json.saveData);
      this.currentSave = migrated;
      return migrated;
    } catch (err) {
      // Server unavailable — fall back to local storage silently
      console.info('[SaveService] API unavailable, using local save:', (err as Error).message);
      const emergency = this.loadEmergencyBackup();
      if (emergency) {
        this.currentSave = emergency;
        return emergency;
      }
      const fresh = this.createFresh();
      this.currentSave = fresh;
      this.writeEmergencyBackup(fresh); // persist locally immediately
      return fresh;
    }
  }

  async save(data: SaveData): Promise<void> {
    data.lastSavedAt = new Date().toISOString();
    this.currentSave = data;

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, saveData: data }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Verify write succeeded
      const verify = await res.json() as { ok: boolean };
      if (!verify.ok) throw new Error('Server responded with ok:false');
    } catch (err) {
      console.warn('[SaveService] Remote save failed, writing emergency backup:', err);
      this.writeEmergencyBackup(data);
    }
  }

  async reset(): Promise<void> {
    await fetch(`/api/save?userId=${encodeURIComponent(this.userId)}`, { method: 'DELETE' });
    localStorage.removeItem(EMERGENCY_KEY);
    this.currentSave = null;
  }

  async hasSave(): Promise<boolean> {
    try {
      const res = await fetch(`/api/save?userId=${encodeURIComponent(this.userId)}`);
      return res.ok;
    } catch {
      return this.loadEmergencyBackup() !== null;
    }
  }

  getCurrent(): SaveData | null {
    return this.currentSave;
  }

  private autoSaveSetup = false;

  /** Auto-save hook — wires to EventBus */
  setupAutoSave(): void {
    if (this.autoSaveSetup) return;
    this.autoSaveSetup = true;
    const saveNow = () => {
      if (this.currentSave) this.save(this.currentSave);
    };
    EventBus.on(GameEvents.ROOM_CLEARED, saveNow);
    EventBus.on(GameEvents.RUN_ENDED, saveNow);
    EventBus.on(GameEvents.PRESTIGE_UNLOCKED, saveNow);
  }

  private createFresh(): SaveData {
    return { ...DEFAULT_SAVE, userId: this.userId, version: CURRENT_VERSION };
  }

  private migrate(raw: Record<string, unknown>): SaveData {
    let data = raw;
    let ver = (data['version'] as number) ?? 1;
    while (ver < CURRENT_VERSION) {
      const fn = MIGRATIONS.get(ver);
      if (!fn) break;
      data = fn(data) as unknown as Record<string, unknown>;
      ver++;
    }
    return data as unknown as SaveData;
  }

  private writeEmergencyBackup(data: SaveData): void {
    try {
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(data));
    } catch {
      console.error('[SaveService] Emergency backup also failed (localStorage full?)');
    }
  }

  private loadEmergencyBackup(): SaveData | null {
    const raw = localStorage.getItem(EMERGENCY_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  }
}

export const SaveService = new SaveServiceClass();
