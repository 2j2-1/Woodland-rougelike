import Phaser from 'phaser';
import { NarrativeService } from '@/systems/NarrativeService';
import { SaveService } from '@/systems/SaveService';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

interface TriggerZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onEnter: () => void;
}

/**
 * HubScene — The Great Oak hub area.
 * The player can walk around, talk to NPCs, access skill tree, prestige altar.
 */
export class HubScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private hintText!: Phaser.GameObjects.Text;
  private triggerZones: TriggerZone[] = [];
  private activeTrigger: TriggerZone | null = null;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private metaScrapsText!: Phaser.GameObjects.Text;
  private _onMetaScrapsChanged?: (d: { metaScraps: number }) => void;  // For cleanup

  constructor() {
    super({ key: 'HubScene' });
  }

  async create(): Promise<void> {
    const save = SaveService.getCurrent()!;

    this.cameras.main.setBackgroundColor('#1a2a0e');

    const { width, height } = this.scale;

    // Hub floor
    this.add.rectangle(width / 2, height / 2, width - 40, height - 40, 0x1e3a14)
      .setStrokeStyle(2, 0x446622);

    // Great Oak backdrop
    this.add.text(width / 2, 80, '🌳 The Great Oak', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#84c464',
    }).setOrigin(0.5);

    // Player placeholder
    this.playerSprite = this.add.arc(width / 2, height / 2, 14, 0, 360, false, 0x74c69d);
    this.physics.add.existing(this.playerSprite);

    // NPCs
    this.buildNPCs(save);
    // Currency display
    this.metaScrapsText = this.add.text(16, height - 30, `⚙ ${save.metaScraps} scraps`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#d4a844',
    });

    this._onMetaScrapsChanged = (d: { metaScraps: number }) => {
      this.metaScrapsText.setText(`⚙ ${d.metaScraps} scraps`);
    };
    EventBus.on(GameEvents.META_SCRAP_CHANGED, this._onMetaScrapsChanged);

    // Hint text
    this.hintText = this.add.text(width / 2, height - 50, '', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8e6c2',
    }).setOrigin(0.5);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    NarrativeService.applyFlagsFromSave(save);

    // "Begin Run" button
    this.addBeginRunButton();
  }

  private buildNPCs(save: ReturnType<typeof SaveService.getCurrent>): void {
    const { width, height } = this.scale;

    // Elderwick NPC
    this.addNPC(
      width * 0.25, height * 0.4, '👴 Elderwick',
      'Talk to Elderwick',
      () => this.talkToNPC('elderwick')
    );

    // Humphrey (Blacksmith) NPC
    this.addNPC(
      width * 0.75, height * 0.4, '🔨 Humphrey',
      'Browse wares',
      () => this.talkToNPC('humphrey')
    );

    // Skill tree archive
    this.addNPC(
      width * 0.5, height * 0.25, '📜 Skill Archive',
      'Open skill tree [E]',
      () => this.openUIPanel('skilltree')
    );

    // Prestige altar (conditional)
    if (save?.narrativeFlags.includes('FIRST_BOSS_DEFEAT')) {
      this.addNPC(
        width * 0.5, height * 0.75, '⚡ Prestige Altar',
        'Claim prestige rewards',
        () => this.openUIPanel('prestige')
      );
    }
  }

  private addNPC(x: number, y: number, label: string, hint: string, onInteract: () => void): void {
    this.add.arc(x, y, 18, 0, 360, false, 0x888866);
    this.add.text(x, y + 28, label, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8c8a0', align: 'center',
    }).setOrigin(0.5);

    this.triggerZones.push({
      id: label,
      x: x - 60, y: y - 60, width: 120, height: 120,
      label: hint,
      onEnter: onInteract,
    });
  }

  private addBeginRunButton(): void {
    const { width, height } = this.scale;
    const btn = this.add.text(width / 2, height - 80, '[ Begin Run ]', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#74C69D',
      backgroundColor: '#1a2a1a', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout',  () => btn.setStyle({ color: '#74C69D' }));
    btn.on('pointerup',   () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('GameScene');
      });
    });
  }

  private openUIPanel(mode: 'skilltree' | 'prestige' | 'dialogue', extra?: Record<string, unknown>): void {
    if (this.scene.isActive('UIScene')) {
      EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode, ...extra });
    } else {
      this.scene.launch('UIScene', { mode, ...extra });
    }
  }

  private talkToNPC(npcId: string): void {
    const tree = NarrativeService.resolveDialogue(npcId);
    if (!tree) return;
    EventBus.emit(GameEvents.DIALOGUE_STARTED, { npcId, node: tree });
    this.openUIPanel('dialogue', { npcId, node: tree });
  }

  update(): void {
    const speed = 160;
    const body = this.playerSprite.body as Phaser.Physics.Arcade.Body;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown  || this.wasd.A.isDown) vx = -speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed;
    if (this.cursors.up.isDown    || this.wasd.W.isDown) vy = -speed;
    if (this.cursors.down.isDown  || this.wasd.S.isDown) vy = speed;

    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    body.setVelocity(vx, vy);

    // Check trigger zones
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;
    let found: TriggerZone | null = null;

    for (const zone of this.triggerZones) {
      if (px >= zone.x && px <= zone.x + zone.width && py >= zone.y && py <= zone.y + zone.height) {
        found = zone;
        break;
      }
    }

    if (found !== this.activeTrigger) {
      this.activeTrigger = found;
      this.hintText.setText(found ? `[E] ${found.label}` : '');
    }

    if (found && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      found.onEnter();
    }
  }

  shutdown(): void {
    // Clean up EventBus listener
    if (this._onMetaScrapsChanged) {
      EventBus.off(GameEvents.META_SCRAP_CHANGED, this._onMetaScrapsChanged);
    }
  }
}
