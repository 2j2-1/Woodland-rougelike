import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import type { GameScene } from '@/scenes/GameScene';

/**
 * Chip Terminal — interactable room object that opens the Chip selection UI.
 * Can only be used once per room.
 */
export class ChipTerminal extends Phaser.GameObjects.Container {
  private isUsed = false;
  private hintText!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);

    // Terminal sprite (placeholder rectangle with green glow)
    const body = scene.add.rectangle(0, 0, 32, 40, 0x112211);
    body.setStrokeStyle(2, 0x22cc44);
    this.add(body);

    // Circuit icon placeholder
    const icon = scene.add.text(0, 0, '◈', {
      fontFamily: 'monospace', fontSize: '18px', color: '#22cc44',
    }).setOrigin(0.5);
    this.add(icon);

    // Glow pulse
    this.glowTween = scene.tweens.add({
      targets: icon,
      alpha: { from: 0.5, to: 1.0 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Hint text
    this.hintText = scene.add.text(x, y - 40, '[E] Chip Terminal', {
      fontFamily: 'monospace', fontSize: '11px', color: '#22cc44',
      backgroundColor: '#001100',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setVisible(false);

    // Interaction zone
    const zone = scene.add.zone(x, y, 140, 140).setInteractive();
    zone.on('pointerover', () => this.hintText.setVisible(!this.isUsed));
    zone.on('pointerout',  () => this.hintText.setVisible(false));

    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  update(): void {
    if (this.isUsed) return;

    if (this.hintText.visible && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.open();
    }
  }

  private open(): void {
    this.isUsed = true;
    this.hintText.setVisible(false);
    this.glowTween?.stop();

    EventBus.emit(GameEvents.CHIP_CHANGED, { runChips: 0 }); // signal open

    // Launch chip terminal UI via UIScene
    this.scene.scene.launch('UIScene', { mode: 'chip-terminal', terminal: this });
  }

  /** Called by ChipTerminalUI on selection close */
  onClose(): void {
    // Dim the terminal
    const rect = this.list[0] as Phaser.GameObjects.Rectangle;
    rect?.setFillStyle(0x0a110a);
    rect?.setStrokeStyle(1, 0x224422);
    const icon = this.list[1] as Phaser.GameObjects.Text;
    icon?.setAlpha(0.3);
  }
}
