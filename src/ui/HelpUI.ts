import Phaser from 'phaser';

const DEPTH = 200;

export class HelpUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0).setVisible(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.build();
    else this.container.setVisible(false);
  }

  private build(): void {
    this.container.removeAll(true);
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panW = 620;
    const panH = 520;

    // Background panel
    this.container.add(
      this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93).setStrokeStyle(1, 0x446644),
    );

    // Title
    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 20, 'HOW TO PLAY', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#74C69D',
      }).setOrigin(0.5),
    );

    const startY = cy - panH / 2 + 60;
    let currentY = startY;

    // Helper function to add a section
    const addSection = (title: string, content: string[]) => {
      this.container.add(
        this.scene.add.text(cx - panW / 2 + 20, currentY, title, {
          fontFamily: 'Georgia, serif',
          fontSize: '14px',
          color: '#d4a844',
          fontStyle: 'bold',
        }),
      );
      currentY += 24;

      content.forEach((line) => {
        this.container.add(
          this.scene.add.text(cx - panW / 2 + 30, currentY, line, {
            fontFamily: 'Georgia, serif',
            fontSize: '12px',
            color: '#c8c8aa',
            wordWrap: { width: panW - 60 },
          }),
        );
        currentY += 18;
      });

      currentY += 8;
    };

    // Gameplay
    addSection('OBJECTIVE', [
      'Survive waves of enemies and defeat the boss at the end of each Act.',
      'Collect Scrap (⚙) to buy upgrades. Earn Chips (◈) from combat.',
    ]);

    // Controls
    addSection('CONTROLS', [
      'WASD or Arrow Keys — Move',
      'SPACE or LMB — Attack / Interact',
      'Q — Use Ability',
      'TAB or I — Inventory',
      'ESC — Pause Menu',
    ]);

    // Upgrades & Progression
    addSection('UPGRADES & PROGRESSION', [
      'At the end of each room, choose from 3 random Chips to enhance your abilities.',
      'Chips stack; combining the same Chip multiple times increases its effect.',
      'Visit the Blacksmith to spend Scrap on permanent upgrades.',
    ]);

    // Tips
    addSection('HELPFUL TIPS', [
      '• Positioning matters — stay mobile and dodge incoming attacks.',
      '• Chips synergize with your animal companion\'s unique playstyle.',
      '• Prestige unlocks new animals and endgame content.',
      '• Check the Memo Archive for lore and story details.',
    ]);

    // Close button
    const closeBtn = this.scene.add.text(cx + panW / 2 - 16, cy - panH / 2 + 14, '×', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#aa4444',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.toggle());
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }
}
