import Phaser from 'phaser';
import { TouchInputState } from '@/systems/TouchInputState';

const STICK_RADIUS = 78;
const KNOB_RADIUS  = 38;

/**
 * On-screen virtual controls for touch devices.
 *
 * Layout (1280 × 720 canvas):
 *  ┌──────────────────────────────────────────────────────────┐
 *  │                                               [⏸]       │  ← pause (top-right)
 *  │                                                          │
 *  │                                                          │
 *  │                                         [E]  [DASH]     │  ← interact + dash
 *  │  [move joystick – floating]             [Q]             │  ← secondary
 *  └──────────────────────────────────────────────────────────┘
 *
 * Both joysticks are "floating" – they appear where the user first touches
 * the respective half of the screen.  Action buttons are fixed.
 */
export class MobileControls {
  private readonly scene: Phaser.Scene;
  private readonly W: number;
  private readonly H: number;

  // Move joystick graphics
  private moveBase!: Phaser.GameObjects.Arc;
  private moveKnob!: Phaser.GameObjects.Arc;
  // Aim joystick graphics
  private aimBase!: Phaser.GameObjects.Arc;
  private aimKnob!: Phaser.GameObjects.Arc;

  // Active pointers for each joystick
  private movePtr: Phaser.Input.Pointer | null = null;
  private aimPtr:  Phaser.Input.Pointer | null = null;

  // Hit-zones for action buttons so joystick logic can skip them
  private readonly btnZones: Array<{ cx: number; cy: number; r: number }> = [];

  // Stored handler references for clean removal
  private _onDown!: (ptr: Phaser.Input.Pointer) => void;
  private _onMove!: (ptr: Phaser.Input.Pointer) => void;
  private _onUp!:   (ptr: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.W = scene.scale.width;
    this.H = scene.scale.height;

    this.buildSticks();
    this.buildButtons();
    this.bindTouch();
  }

  // ── Joystick graphics ──────────────────────────────────────────────────────

  private buildSticks(): void {
    // Movement joystick (white)
    this.moveBase = this.scene.add.circle(0, 0, STICK_RADIUS, 0xffffff, 0.12)
      .setDepth(200).setVisible(false);
    this.moveBase.setStrokeStyle(2, 0xffffff, 0.35);

    this.moveKnob = this.scene.add.circle(0, 0, KNOB_RADIUS, 0xffffff, 0.40)
      .setDepth(201).setVisible(false);

    // Aim joystick (green accent)
    this.aimBase = this.scene.add.circle(0, 0, STICK_RADIUS, 0x74C69D, 0.12)
      .setDepth(200).setVisible(false);
    this.aimBase.setStrokeStyle(2, 0x74C69D, 0.35);

    this.aimKnob = this.scene.add.circle(0, 0, KNOB_RADIUS, 0x74C69D, 0.40)
      .setDepth(201).setVisible(false);
  }

  // ── Action buttons ─────────────────────────────────────────────────────────

  private buildButtons(): void {
    const { W, H } = this;

    // DASH  – large, bottom-right
    this.addBtn(W - 110, H - 105, 58, 'DASH', 0xcc4444, () => { TouchInputState.dash = true; });
    // SECONDARY (Q) – left of dash
    this.addBtn(W - 215, H - 95,  42, 'Q',    0x7744cc, () => { TouchInputState.secondary = true; });
    // INTERACT (E) – above dash
    this.addBtn(W - 145, H - 205, 40, 'E',    0x4488cc, () => { TouchInputState.interact = true; });
    // PAUSE – small, top-right corner
    this.addBtn(W - 38,  38,      26, '⏸',   0x888888, () => { TouchInputState.pause = true; });
  }

  private addBtn(
    cx: number, cy: number, r: number,
    label: string, color: number,
    onPress: () => void,
  ): void {
    const btn = this.scene.add.circle(cx, cy, r, color, 0.62)
      .setStrokeStyle(2, 0xffffff, 0.40)
      .setDepth(200)
      .setInteractive();

    this.scene.add.text(cx, cy, label, {
      fontFamily: 'monospace',
      fontSize: `${Math.max(10, Math.floor(r * 0.50))}px`,
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(201);

    this.btnZones.push({ cx, cy, r });
    btn.on('pointerdown', onPress);
  }

  // ── Touch binding ──────────────────────────────────────────────────────────

  private bindTouch(): void {
    this._onDown = (ptr: Phaser.Input.Pointer) => {
      if (this.hitsButton(ptr.x, ptr.y)) return;

      const isLeft = ptr.x < this.W * 0.5;

      if (isLeft && !this.movePtr) {
        this.movePtr = ptr;
        this.moveBase.setPosition(ptr.x, ptr.y).setVisible(true);
        this.moveKnob.setPosition(ptr.x, ptr.y).setVisible(true);
      } else if (!isLeft && !this.aimPtr) {
        this.aimPtr = ptr;
        this.aimBase.setPosition(ptr.x, ptr.y).setVisible(true);
        this.aimKnob.setPosition(ptr.x, ptr.y).setVisible(true);
      }
    };

    this._onMove = (ptr: Phaser.Input.Pointer) => {
      if (ptr === this.movePtr) {
        this.updateKnob(ptr, this.moveBase, this.moveKnob, (nx, ny) => {
          TouchInputState.moveX = nx;
          TouchInputState.moveY = ny;
        });
      }
      if (ptr === this.aimPtr) {
        this.updateKnob(ptr, this.aimBase, this.aimKnob, (nx, ny) => {
          if (nx !== 0 || ny !== 0) {
            TouchInputState.aimAngle = Math.atan2(ny, nx);
            TouchInputState.hasAim   = true;
          }
        });
      }
    };

    this._onUp = (ptr: Phaser.Input.Pointer) => {
      if (ptr === this.movePtr) {
        this.movePtr = null;
        this.moveBase.setVisible(false);
        this.moveKnob.setVisible(false);
        TouchInputState.moveX = 0;
        TouchInputState.moveY = 0;
      }
      if (ptr === this.aimPtr) {
        this.aimPtr = null;
        this.aimBase.setVisible(false);
        this.aimKnob.setVisible(false);
        TouchInputState.hasAim = false;
      }
    };

    this.scene.input.on('pointerdown', this._onDown);
    this.scene.input.on('pointermove', this._onMove);
    this.scene.input.on('pointerup',   this._onUp);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private updateKnob(
    ptr: Phaser.Input.Pointer,
    base: Phaser.GameObjects.Arc,
    knob: Phaser.GameObjects.Arc,
    out: (nx: number, ny: number) => void,
  ): void {
    const dx   = ptr.x - base.x;
    const dy   = ptr.y - base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) { out(0, 0); return; }

    const nx      = dx / dist;
    const ny      = dy / dist;
    const capped  = Math.min(dist, STICK_RADIUS);
    knob.setPosition(base.x + nx * capped, base.y + ny * capped);
    out(nx * Math.min(dist / STICK_RADIUS, 1), ny * Math.min(dist / STICK_RADIUS, 1));
  }

  private hitsButton(x: number, y: number): boolean {
    return this.btnZones.some(b => Math.hypot(x - b.cx, y - b.cy) <= b.r);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.scene.input.off('pointerdown', this._onDown);
    this.scene.input.off('pointermove', this._onMove);
    this.scene.input.off('pointerup',   this._onUp);
    this.moveBase?.destroy();
    this.moveKnob?.destroy();
    this.aimBase?.destroy();
    this.aimKnob?.destroy();
  }
}
