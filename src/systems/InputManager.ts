import Phaser from 'phaser';
import type { GameScene } from '@/scenes/GameScene';

/** Centralises keyboard + gamepad input to avoid duplicated key checks. */
export class InputManager {
  private scene: GameScene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private gamepad?: Phaser.Input.Gamepad.Gamepad;

  readonly DEAD_ZONE = 0.15;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = {
      W:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE:   scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      Q:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      E:       scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      ESC:     scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    scene.input.gamepad?.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
      this.gamepad = pad;
    });
    scene.input.gamepad?.on('disconnected', () => {
      this.gamepad = undefined;
    });
  }

  update(): void {
    // Gamepad snapshot updated by Phaser automatically
    this.gamepad = this.scene.input.gamepad?.pad1 ?? undefined;
  }

  getMoveVector(): Phaser.Math.Vector2 {
    let x = 0, y = 0;

    if (this.cursors.left.isDown  || this.keys['A'].isDown) x = -1;
    if (this.cursors.right.isDown || this.keys['D'].isDown) x = 1;
    if (this.cursors.up.isDown    || this.keys['W'].isDown) y = -1;
    if (this.cursors.down.isDown  || this.keys['S'].isDown) y = 1;

    if (this.gamepad) {
      const lx = this.gamepad.leftStick.x;
      const ly = this.gamepad.leftStick.y;
      if (Math.abs(lx) > this.DEAD_ZONE) x = lx;
      if (Math.abs(ly) > this.DEAD_ZONE) y = ly;
    }

    return new Phaser.Math.Vector2(x, y).normalize();
  }

  getAimAngle(): number {
    if (this.gamepad) {
      const rx = this.gamepad.rightStick.x;
      const ry = this.gamepad.rightStick.y;
      if (Math.sqrt(rx * rx + ry * ry) > this.DEAD_ZONE) {
        return Math.atan2(ry, rx);
      }
    }
    const pointer = this.scene.input.activePointer;
    const world   = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return Phaser.Math.Angle.Between(
      this.scene.player.x, this.scene.player.y,
      world.x, world.y
    );
  }

  isActionJustPressed(action: 'DASH' | 'SECONDARY' | 'INTERACT' | 'PAUSE'): boolean {
    switch (action) {
      case 'DASH':      return Phaser.Input.Keyboard.JustDown(this.keys['SPACE']!) ||
                               (this.gamepad?.A === true);
      case 'SECONDARY': return Phaser.Input.Keyboard.JustDown(this.keys['Q']!);
      case 'INTERACT':  return Phaser.Input.Keyboard.JustDown(this.keys['E']!);
      case 'PAUSE':     return Phaser.Input.Keyboard.JustDown(this.keys['ESC']!);
    }
  }
}
