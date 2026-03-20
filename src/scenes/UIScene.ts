import Phaser from 'phaser';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';
import { Minimap } from '@/ui/Minimap';
import { SettingsUI } from '@/ui/SettingsUI';
import { SkillTreeUI } from '@/ui/SkillTreeUI';
import { PrestigeAltarUI } from '@/ui/PrestigeAltarUI';
import { DialogueBox } from '@/ui/DialogueBox';
import { HelpUI } from '@/ui/HelpUI';
import { MobileControls } from '@/ui/MobileControls';
import { TouchInputState } from '@/systems/TouchInputState';
import type { RunGraph } from '@/systems/RunGraph';
import type { DialogueNode } from '@/types/content';

type UIMode = 'hud' | 'settings' | 'skilltree' | 'prestige' | 'dialogue' | 'help';

/**
 * UIScene — runs in parallel with GameScene or HubScene.
 * Owns all HUD elements, menus, and overlay panels.
 * Communicates with other scenes exclusively via EventBus (no direct ref swapping).
 */
export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private scrapText!: Phaser.GameObjects.Text;
  private chipText!: Phaser.GameObjects.Text;
  private minimap!: Minimap;
  private settingsUI!: SettingsUI;
  private skillTreeUI!: SkillTreeUI;
  private prestigeUI!: PrestigeAltarUI;
  private dialogueBox!: DialogueBox;
  private helpUI!: HelpUI;
  private isPaused = false;
  private pauseContainer?: Phaser.GameObjects.Container;
  private mobileControls?: MobileControls;

  // Cached HUD values
  private hp = 100;
  private maxHp = 100;
  private stamina = 100;
  private maxStamina = 100;
  private scraps = 0;
  private chips = 0;

  // Named listener references so we can remove them in shutdown()
  private _onDamaged!:   (d: { hp: number; maxHp: number }) => void;
  private _onHealed!:    (d: { hp: number; maxHp: number }) => void;
  private _onStamina!:   (d: { stamina: number; maxStamina: number }) => void;
  private _onScrap!:     (d: { runScraps: number }) => void;
  private _onChip!:      (d: { runChips: number }) => void;
  private _onStats!:     () => void;
  private _onPanelOpen!: (d: { mode: UIMode; npcId?: string; node?: DialogueNode }) => void;
  private _onGraphReady!: (d: { graph: RunGraph }) => void;
  private _onRoomEntered!: (d: { col: number; row: number; cleared: boolean }) => void;
  private _onRoomCleared!: () => void;

  /** Tracks current minimap position so ROOM_CLEARED can mark the right cell. */
  private _minimapCol = 4;
  private _minimapRow = 4;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(data?: { mode?: UIMode; npcId?: string; node?: DialogueNode }): void {
    // Fixed camera — no scrolling
    this.cameras.main.setScroll(0, 0);

    this.buildHUD();
    this.minimap = new Minimap(this);

    // Instantiate overlay panels
    this.settingsUI  = new SettingsUI(this);
    this.skillTreeUI = new SkillTreeUI(this);
    this.prestigeUI  = new PrestigeAltarUI(this);
    this.dialogueBox = new DialogueBox(this);
    this.helpUI      = new HelpUI(this);

    this.wireEvents();
    this.registerInputs();

    // Mount mobile controls on touch devices
    if (this.sys.game.device.input.touch) {
      this.mobileControls = new MobileControls(this);
    }

    // Handle mode passed at launch time
    const mode = data?.mode ?? 'hud';
    if (mode !== 'hud') {
      this.openPanel(mode, data);
    }
  }

  private buildHUD(): void {
    const pad = 16;

    // HP bar background
    this.add.rectangle(pad + 80, pad + 14, 160, 12, 0x220000).setOrigin(0, 0.5);
    this.hpBar = this.add.graphics();
    this.hpText = this.add.text(pad, pad + 14, '100 / 100', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff8888',
    }).setOrigin(0, 0.5);

    // Stamina bar background
    this.add.rectangle(pad + 80, pad + 34, 160, 8, 0x002200).setOrigin(0, 0.5);
    this.staminaBar = this.add.graphics();

    // Currency
    this.scrapText = this.add.text(pad, pad + 54, '⚙ 0', {
      fontFamily: 'monospace', fontSize: '13px', color: '#d4a844',
    });
    this.chipText = this.add.text(pad + 80, pad + 54, '◈ 0', {
      fontFamily: 'monospace', fontSize: '13px', color: '#74C69D',
    });

    this.redrawBars();
  }

  private redrawBars(): void {
    const pad = 16;

    // HP
    this.hpBar.clear();
    this.hpBar.fillStyle(0xcc2222, 1);
    const hpFrac = Math.max(0, this.hp / this.maxHp);
    this.hpBar.fillRect(pad + 80, pad + 8, Math.floor(160 * hpFrac), 12);
    this.hpText?.setText(`${Math.ceil(this.hp)} / ${this.maxHp}`);

    // Stamina
    this.staminaBar.clear();
    this.staminaBar.fillStyle(0x22aa44, 1);
    const stFrac = Math.max(0, this.stamina / this.maxStamina);
    this.staminaBar.fillRect(pad + 80, pad + 30, Math.floor(160 * stFrac), 8);
  }

  private wireEvents(): void {
    this._onDamaged = (d) => { this.hp = d.hp; this.maxHp = d.maxHp; this.redrawBars(); };
    this._onHealed  = (d) => { this.hp = d.hp; this.maxHp = d.maxHp; this.redrawBars(); };
    this._onStamina = (d) => { this.stamina = d.stamina; this.maxStamina = d.maxStamina; this.redrawBars(); };
    this._onScrap   = (d) => { this.scraps = d.runScraps; this.scrapText?.setText(`⚙ ${this.scraps}`); };
    this._onChip    = (d) => { this.chips  = d.runChips;  this.chipText?.setText(`◈ ${this.chips}`); };
    this._onStats     = () => {};
    this._onPanelOpen = (d) => this.openPanel(d.mode, d);

    this._onGraphReady = ({ graph }) => {
      this.minimap.setGraph(graph);
    };
    this._onRoomEntered = ({ col, row, cleared }) => {
      this._minimapCol = col;
      this._minimapRow = row;
      this.minimap.moveTo(col, row);
      if (cleared) this.minimap.markCleared(col, row);
    };
    this._onRoomCleared = () => {
      this.minimap.markCleared(this._minimapCol, this._minimapRow);
    };

    EventBus.on(GameEvents.PLAYER_DAMAGED,         this._onDamaged);
    EventBus.on(GameEvents.PLAYER_HEALED,          this._onHealed);
    EventBus.on(GameEvents.PLAYER_STAMINA_CHANGED, this._onStamina);
    EventBus.on(GameEvents.SCRAP_CHANGED,          this._onScrap);
    EventBus.on(GameEvents.CHIP_CHANGED,           this._onChip);
    EventBus.on(GameEvents.PLAYER_STATS_CHANGED,   this._onStats);
    EventBus.on(GameEvents.UI_PANEL_OPEN,          this._onPanelOpen);
    EventBus.on(GameEvents.GRAPH_READY,            this._onGraphReady);
    EventBus.on(GameEvents.ROOM_ENTERED,           this._onRoomEntered);
    EventBus.on(GameEvents.ROOM_CLEARED,           this._onRoomCleared);
  }

  shutdown(): void {
    this.mobileControls?.destroy();
    EventBus.off(GameEvents.PLAYER_DAMAGED,         this._onDamaged);
    EventBus.off(GameEvents.PLAYER_HEALED,          this._onHealed);
    EventBus.off(GameEvents.PLAYER_STAMINA_CHANGED, this._onStamina);
    EventBus.off(GameEvents.SCRAP_CHANGED,          this._onScrap);
    EventBus.off(GameEvents.CHIP_CHANGED,           this._onChip);
    EventBus.off(GameEvents.PLAYER_STATS_CHANGED,   this._onStats);
    EventBus.off(GameEvents.UI_PANEL_OPEN,          this._onPanelOpen);
    EventBus.off(GameEvents.GRAPH_READY,            this._onGraphReady);
    EventBus.off(GameEvents.ROOM_ENTERED,           this._onRoomEntered);
    EventBus.off(GameEvents.ROOM_CLEARED,           this._onRoomCleared);
  }

  private openPanel(mode: UIMode, data?: { npcId?: string; node?: DialogueNode }): void {
    switch (mode) {
      case 'settings':  this.settingsUI.toggle();  break;
      case 'skilltree': this.skillTreeUI.toggle();  break;
      case 'prestige':  this.prestigeUI.toggle();   break;
      case 'help':      this.helpUI.toggle();       break;
      case 'dialogue':
        if (data?.node) this.dialogueBox.play([data.node]);
        break;
    }
  }

  private registerInputs(): void {
    const esc = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    esc?.on('down', () => this.togglePause());
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    const gameScene = this.scene.get('GameScene');
    if (this.isPaused) {
      gameScene.scene.pause();
      this.showPauseMenu();
    } else {
      gameScene.scene.resume();
      this.hidePauseMenu();
    }
  }

  private showPauseMenu(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.6);
    const panel   = this.add.rectangle(cx, cy, 280, 220, 0x1a1a0a, 0.95);
    panel.setStrokeStyle(1, 0x446644);
    const title = this.add.text(cx, cy - 75, 'PAUSED', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#74C69D',
    }).setOrigin(0.5);

    const resumeBtn = this.makeBtn(cx, cy - 20, 'Resume', () => this.togglePause());
    const settingsBtn = this.makeBtn(cx, cy + 30, 'Settings', () => {
      // TODO: open settings panel
    });
    const quitBtn = this.makeBtn(cx, cy + 80, 'Quit to Menu', () => {
      this.isPaused = false;
      this.scene.get('GameScene').scene.stop();
      this.scene.stop();
      this.scene.start('MainMenuScene');
    });

    this.pauseContainer = this.add.container(0, 0, [overlay, panel, title, resumeBtn, settingsBtn, quitBtn]);
  }

  private hidePauseMenu(): void {
    this.pauseContainer?.destroy();
    this.pauseContainer = undefined;
  }

  private makeBtn(x: number, y: number, label: string, cb: () => void): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8e6c2',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    t.on('pointerover', () => t.setStyle({ color: '#ffffff' }));
    t.on('pointerout',  () => t.setStyle({ color: '#c8e6c2' }));
    t.on('pointerup',   () => cb());
    return t;
  }

  update(): void {
    this.minimap.update();
    // Bridge mobile pause button → pause logic
    if (TouchInputState.consumePause()) {
      this.togglePause();
    }
  }
}
