import Phaser from 'phaser';

/** Wraps camera shake presets cleanly */
export class ScreenShakeManager {
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
  }

  /** Light hit feedback */
  light(): void  { this.cam.shake(100, 0.004); }
  /** Medium impact */
  medium(): void { this.cam.shake(200, 0.008); }
  /** Heavy boss hit or explosion */
  heavy(): void  { this.cam.shake(350, 0.016); }
  /** Boss phase transition */
  phaseShift(): void { this.cam.shake(500, 0.025); }
  /** Custom */
  custom(durationMs: number, intensity: number): void {
    this.cam.shake(durationMs, intensity);
  }
}
