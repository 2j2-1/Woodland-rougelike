/**
 * Shared singleton updated by MobileControls (UIScene) and read by InputManager (GameScene).
 * Using a plain object avoids import cycles and keeps the bridge ultra-lightweight.
 */
export const TouchInputState = {
  /** Normalised move vector X from the virtual joystick (-1 … 1). */
  moveX: 0,
  /** Normalised move vector Y from the virtual joystick (-1 … 1). */
  moveY: 0,
  /** Aim angle in radians from the right-stick virtual joystick. */
  aimAngle: 0,
  /** True while the aim joystick is being held. */
  hasAim: false,

  dash:      false,
  secondary: false,
  interact:  false,
  pause:     false,

  consumeDash():      boolean { const v = this.dash;      this.dash      = false; return v; },
  consumeSecondary(): boolean { const v = this.secondary; this.secondary = false; return v; },
  consumeInteract():  boolean { const v = this.interact;  this.interact  = false; return v; },
  consumePause():     boolean { const v = this.pause;     this.pause     = false; return v; },
};
