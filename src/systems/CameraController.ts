import Phaser from 'phaser';
import type { GameScene } from '@/scenes/GameScene';

type ShakePreset = 'playerHit' | 'dashImpact' | 'explosion' | 'bossSlam' | 'bossPhaseTransition';

const SHAKE_PRESETS: Record<ShakePreset, { duration: number; intensity: number }> = {
  playerHit:            { duration: 150, intensity: 0.006 },
  dashImpact:           { duration: 80,  intensity: 0.003 },
  explosion:            { duration: 300, intensity: 0.012 },
  bossSlam:             { duration: 250, intensity: 0.018 },
  bossPhaseTransition:  { duration: 500, intensity: 0.025 },
};

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private scene: GameScene;
  private reducedMotion = false;

  constructor(scene: GameScene) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
  }

  followPlayer(player: Phaser.GameObjects.GameObject): void {
    this.camera.startFollow(player, true, 0.08, 0.08);
  }

  constrainToRoom(width: number, height: number): void {
    this.camera.setBounds(0, 0, width, height);
  }

  shake(preset: ShakePreset): void {
    const p = SHAKE_PRESETS[preset];
    const intensity = this.reducedMotion ? 0 : p.intensity;
    this.camera.shake(p.duration, intensity);
  }

  setReducedMotion(v: boolean): void { this.reducedMotion = v; }

  fadeOut(duration: number, r = 0, g = 0, b = 0): void {
    this.camera.fadeOut(duration, r, g, b);
  }

  fadeIn(duration: number, r = 0, g = 0, b = 0): void {
    this.camera.fadeIn(duration, r, g, b);
  }

  tweenTo(x: number, y: number, duration: number): void {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: x - this.camera.width / 2,
      scrollY: y - this.camera.height / 2,
      duration,
      ease: 'Quad.easeInOut',
    });
  }

  zoomTo(value: number, duration: number): void {
    this.scene.tweens.add({
      targets: this.camera,
      zoom: value,
      duration,
      ease: 'Sine.easeInOut',
    });
  }
}
