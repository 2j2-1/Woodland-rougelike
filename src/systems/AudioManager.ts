import { Howl, Howler } from 'howler';

interface SfxDef { src: string; volume?: number; }

const FADE_MS = 800;

export class AudioManager {
  private static tracks:    Map<string, Howl>   = new Map();
  private static sfxPool:   Map<string, Howl>   = new Map();
  private static currentBg?: string;
  private static sfxVolume = 1.0; // used by setSfxVolume
  private static bgVolume   = 0.7;

  // ── Init ──────────────────────────────────────────────────────────────────

  /** Called once at boot to register all known audio assets */
  static register(sfxDefs: Record<string, SfxDef>): void {
    Object.entries(sfxDefs).forEach(([key, def]) => {
      this.sfxPool.set(key, new Howl({ src: [def.src], volume: def.volume ?? 1.0 }));
    });
  }

  // ── Music ─────────────────────────────────────────────────────────────────

  static playMusic(key: string, src: string, loop = true): void {
    if (this.currentBg === key) return;

    // Fade out current
    if (this.currentBg) {
      const old = this.tracks.get(this.currentBg);
      old?.fade(this.bgVolume, 0, FADE_MS);
      setTimeout(() => old?.stop(), FADE_MS + 50);
    }

    this.currentBg = key;
    if (!this.tracks.has(key)) {
      this.tracks.set(key, new Howl({ src: [src], loop, volume: 0 }));
    }
    const track = this.tracks.get(key)!;
    track.play();
    track.fade(0, this.bgVolume, FADE_MS);
  }

  static stopMusic(): void {
    if (!this.currentBg) return;
    const track = this.tracks.get(this.currentBg);
    track?.fade(this.bgVolume, 0, FADE_MS);
    setTimeout(() => track?.stop(), FADE_MS + 50);
    this.currentBg = undefined;
  }

  // ── SFX ───────────────────────────────────────────────────────────────────

  static playSfx(key: string): void {
    const sfx = this.sfxPool.get(key);
    sfx?.play();
  }

  // ── Volume ────────────────────────────────────────────────────────────────

  static setBgVolume(v: number): void {
    this.bgVolume = v;
    if (this.currentBg) this.tracks.get(this.currentBg)?.volume(v);
  }

  static setSfxVolume(v: number): void {
    this.sfxVolume = v;
    this.sfxPool.forEach(h => h.volume(v));
  }

  static getSfxVolume(): number { return this.sfxVolume; }
  static getMasterVolume(): number { return Howler.volume(); }
}
