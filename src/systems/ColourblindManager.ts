/**
 * Applies post-processing tints for colour-blind accessibility modes.
 * Works by setting a full-screen colour-shifted overlay tint in Phaser.
 */
export type ColourblindMode = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export class ColourblindManager {
  private static mode: ColourblindMode = 'normal';

  static setMode(mode: ColourblindMode): void {
    this.mode = mode;
    document.documentElement.style.filter = this.getCssFilter(mode);
  }

  static getMode(): ColourblindMode { return this.mode; }

  private static getCssFilter(mode: ColourblindMode): string {
    switch (mode) {
      case 'deuteranopia':
        return 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'d\'><feColorMatrix type=\'matrix\' values=\'0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0\'/></filter></svg>#d")';
      case 'protanopia':
        return 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'p\'><feColorMatrix type=\'matrix\' values=\'0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0\'/></filter></svg>#p")';
      case 'tritanopia':
        return 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'t\'><feColorMatrix type=\'matrix\' values=\'0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0\'/></filter></svg>#t")';
      default:
        return 'none';
    }
  }
}
