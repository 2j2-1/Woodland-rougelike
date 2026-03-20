import { AudioManager } from '@/systems/AudioManager';
import { ColourblindManager } from '@/systems/ColourblindManager';
import { SaveService } from '@/systems/SaveService';
import type { SettingsData } from '@/types/game';
import { DEFAULT_SETTINGS } from '@/types/game';

export class SettingsManager {
  static init(): void {
    this.applyAll();
  }

  static get settings(): SettingsData {
    return SaveService.getCurrent()?.settings ?? { ...DEFAULT_SETTINGS };
  }

  static applyAll(): void {
    const s = this.settings;
    AudioManager.setMasterVolume(s.masterVolume);
    AudioManager.setBgVolume(s.musicVolume);
    AudioManager.setSfxVolume(s.sfxVolume);
    ColourblindManager.setMode(s.colourblindMode ? 'deuteranopia' : 'normal');
  }

  static set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    const save = SaveService.getCurrent();
    if (!save) return;
    (save.settings as any)[key] = value;
    switch (key) {
      case 'masterVolume':    AudioManager.setMasterVolume(value as number); break;
      case 'musicVolume':     AudioManager.setBgVolume(value as number);     break;
      case 'sfxVolume':       AudioManager.setSfxVolume(value as number);    break;
      case 'colourblindMode': ColourblindManager.setMode((value as boolean) ? 'deuteranopia' : 'normal'); break;
    }
    SaveService.save(save);
  }
}
