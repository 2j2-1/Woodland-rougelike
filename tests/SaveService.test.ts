/**
 * SaveService tests — uses mocked fetch to test all load/save paths
 * without requiring a running API server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the class internals by re-creating a fresh instance per test
// (the module exports a singleton, so we test its public API with fresh state)
import { SaveService } from '@/systems/SaveService';
import type { SaveData } from '@/types/game';

// ── helpers ───────────────────────────────────────────────────────────────────
const validUUID = '7ded54ec-8869-4cc9-8e11-50b4cf6192a0';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);
}

function makeSave(overrides: Partial<SaveData> = {}): SaveData {
  return {
    version: 2,
    userId: validUUID,
    unlockedAnimals: ['bunny'],
    animalExp: {},
    skillPoints: {},
    unlockedSkills: {},
    claimedPrestigeTracks: [],
    unlockedFeatures: [],
    narrativeFlags: [],
    foundMemoIds: [],
    unlockedAchievements: [],
    metaScraps: 0,
    totalScrapsEarned: 0,
    totalScrapsSpent: 0,
    totalBossDefeats: 0,
    deathsPerAnimal: {},
    totalRunsStarted: 0,
    totalRunsCompleted: 0,
    playtimeSeconds: 0,
    settings: {
      masterVolume: 1, musicVolume: 0.7, sfxVolume: 0.8, fullscreen: false,
      colourblindMode: false, reducedMotion: false, textScale: 1,
      controllerVibration: true, aimAssistStrength: 0.5,
      showDamageNumbers: true, autosave: true,
    },
    lastSavedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('SaveService', () => {
  beforeEach(() => {
    // Reset localStorage between tests
    localStorage.clear();
    // Force a known userId for deterministic tests
    localStorage.setItem('circuit_grove_user_id', validUUID);
    SaveService.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── load ──────────────────────────────────────────────────────────────────

  it('returns remote save data on success (200)', async () => {
    const remote = makeSave({ metaScraps: 99 });
    vi.stubGlobal('fetch', mockFetch(200, { saveData: remote }));

    const data = await SaveService.load();
    expect(data.metaScraps).toBe(99);
    expect(data.userId).toBe(validUUID);
  });

  it('creates a fresh save and returns it when server returns 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}));

    const data = await SaveService.load();
    expect(data.version).toBe(2);
    expect(data.unlockedAnimals).toContain('bunny');
    expect(data.userId).toBe(validUUID);
  });

  it('falls back to localStorage emergency backup when server returns 503', async () => {
    const backed = makeSave({ metaScraps: 42 });
    localStorage.setItem('circuit_grove_emergency_save', JSON.stringify(backed));

    vi.stubGlobal('fetch', mockFetch(503, {}));

    const data = await SaveService.load();
    expect(data.metaScraps).toBe(42);
  });

  it('creates fresh save when API fails AND no emergency backup exists', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}));
    const data = await SaveService.load();
    expect(data.version).toBe(2);
    expect(data.metaScraps).toBe(0);
  });

  it('caches loaded data in getCurrent()', async () => {
    const remote = makeSave({ metaScraps: 7 });
    vi.stubGlobal('fetch', mockFetch(200, { saveData: remote }));

    await SaveService.load();
    expect(SaveService.getCurrent()?.metaScraps).toBe(7);
  });

  // ── save ───────────────────────────────────────────────────────────────────

  it('writes emergency backup when remote save fails', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}));
    const data = makeSave({ metaScraps: 5 });
    await SaveService.save(data);

    const raw = localStorage.getItem('circuit_grove_emergency_save');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as SaveData;
    expect(saved.metaScraps).toBe(5);
  });

  it('stamps lastSavedAt on every save call', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true }));
    const data = makeSave({ lastSavedAt: 'old' });
    await SaveService.save(data);
    expect(data.lastSavedAt).not.toBe('old');
    expect(new Date(data.lastSavedAt).getTime()).toBeGreaterThan(0);
  });

  // ── migration ─────────────────────────────────────────────────────────────

  it('migrates v1 save to v2', async () => {
    const v1 = {
      version: 1,
      userId: validUUID,
      unlockedAnimals: ['bunny'],
      animalExp: {},
      skillPoints: {},
      unlockedSkills: {},
      claimedPrestigeTracks: [],
      unlockedFeatures: [],
      narrativeFlags: [],
      foundMemoIds: [],
      unlockedAchievements: [],
      metaScraps: 0,
      totalScrapsEarned: 0,
      totalScrapsSpent: 0,
      totalBossDefeats: 0,
      playtimeSeconds: 0,
      settings: {
        masterVolume: 1, musicVolume: 0.7, sfxVolume: 0.8, fullscreen: false,
        colourblindMode: false, reducedMotion: false, textScale: 1,
        controllerVibration: true, aimAssistStrength: 0.5,
        showDamageNumbers: true, autosave: true,
      },
      lastSavedAt: new Date().toISOString(),
      // v1 is missing deathsPerAnimal, totalRunsStarted, totalRunsCompleted
    };

    vi.stubGlobal('fetch', mockFetch(200, { saveData: v1 }));
    const data = await SaveService.load();
    expect(data.version).toBe(2);
    expect(data.deathsPerAnimal).toEqual({});
    expect(data.totalRunsStarted).toBe(0);
    expect(data.totalRunsCompleted).toBe(0);
  });

  // ── userId ─────────────────────────────────────────────────────────────────

  it('returns the userId from localStorage', () => {
    expect(SaveService.getUserId()).toBe(validUUID);
  });

  it('generates a new userId when none exists in localStorage', () => {
    localStorage.removeItem('circuit_grove_user_id');
    SaveService.init();
    expect(SaveService.getUserId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
