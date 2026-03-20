# Woodland Roguelike UI Architecture Analysis

## Overview
The Woodland roguelike uses a **scene-based UI system** built on Phaser 3, with a clear separation between gameplay scenes (GameScene, HubScene, MainMenuScene) and UI management (UIScene). All inter-scene communication happens through an **EventBus** pattern to maintain loose coupling.

---

## 1. Scene Organization & Architecture

### Scene Hierarchy
The game uses **multiple parallel scenes**:

- **MainMenuScene**: The entry point with parallax backgrounds, fireflies, and main menu buttons
- **GameScene**: Main gameplay loop with all game systems (rooms, enemies, player, combat)
- **HubScene**: Safe zone where players interact with NPCs, access shops, and prepare for runs
- **UIScene**: Floating UI layer that runs in parallel with GameScene or HubScene
- **BootScene**: Initial game setup
- **PreloadScene**: Asset loading

### Scene Relationships
```
MainMenuScene (standalone)
    ↓
HubScene
    ↓ (launches in parallel)
GameScene ←→ UIScene
    ↓ (launches in parallel)
```

---

## 2. UI System Architecture

### Two-Layer UI Pattern

**Layer 1: Scene-Owned UI** (directly in scenes)
- e.g., Main menu buttons, pause menu elements
- Created directly in scene.create()
- Simple interactions, scene-specific only

**Layer 2: UIScene-Managed Panels** (reusable modal UI)
- Settings, SkillTree, PrestigeAltar, DialogueBox, ChipTerminal, BlacksmithUI, etc.
- Created as classes instantiated in UIScene.create()
- Manage their own containers, visibility, and cleanup
- Communicate via EventBus

### UIScene Structure
Located in [src/scenes/UIScene.ts](src/scenes/UIScene.ts):

```typescript
export class UIScene extends Phaser.Scene {
  // HUD elements (always visible)
  private hpBar!: Phaser.GameObjects.Graphics;
  private scrapText!: Phaser.GameObjects.Text;
  
  // Modal panels (toggle on/off)
  private settingsUI!: SettingsUI;
  private skillTreeUI!: SkillTreeUI;
  private prestigeUI!: PrestigeAltarUI;
  private dialogueBox!: DialogueBox;
  
  // Communication
  private _onPanelOpen!: (d: { mode: UIMode; ... }) => void;
  
  // Core methods
  // - create(): Initialize all UI components
  // - openPanel(mode): Route to specific panel
  // - wireEvents(): Subscribe to EventBus
}
```

**Key Properties:**
- Fixed camera (scroll factor 0) — stays on screen
- Depth layering (200+) — always on top
- EventBus-driven communication
- Clean event listener cleanup in shutdown()

---

## 3. UI Component Building Patterns

### Pattern: Modal Panel Class

All major UI panels follow this standard pattern (see [SettingsUI.ts](src/ui/SettingsUI.ts), [SkillTreeUI.ts](src/ui/SkillTreeUI.ts), etc.):

```typescript
export class YourPanelUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;  // Hold all elements
  private open: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Create an empty container, hidden initially
    this.container = scene.add.container(0, 0)
      .setDepth(200)           // Layer on top
      .setScrollFactor(0)      // Don't move with camera
      .setVisible(false);      // Hidden until toggled
  }

  // Main public method
  toggle(): void {
    this.open = !this.open;
    if (this.open) this.build();    // Rebuild UI
    else           this.container.setVisible(false);
  }

  // All UI construction in build()
  private build(): void {
    this.container.removeAll(true);  // Clean slate
    const { width, height } = this.scene.scale;
    const cx = width / 2;

    // Build background panel
    const panel = this.scene.add.rectangle(cx, height/2, 480, 380, 0x000000, 0.93)
      .setStrokeStyle(1, 0x446644);
    
    // Build content elements
    // ... create all child elements ...
    
    // Add to container so all can be hidden/destroyed together
    this.container.add([panel, title, closeBtn, ...content]);
    this.container.setVisible(true);
  }

  // Close handling
  private close(): void {
    this.toggle();
  }
}
```

### Key Characteristics:
1. **Container-based composition** — all elements grouped in a `Phaser.GameObjects.Container`
2. **Lazy building** — UI only renders when toggle/open is called
3. **Complete cleanup** — `removeAll(true)` destroys all child objects
4. **Modal pattern** — dark overlay rectangle + main panel
5. **Fixed depth/scroll** — stays visible and stationary
6. **Event-driven** — no direct scene references, only EventBus

---

## 4. Adding Event Listeners & Communication

### EventBus Pattern

**Publishing from scenes/systems:**
```typescript
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'settings' });
```

**Subscribing in UIScene:**
```typescript
private wireEvents(): void {
  this._onPanelOpen = (d) => this.openPanel(d.mode, d);
  EventBus.on(GameEvents.UI_PANEL_OPEN, this._onPanelOpen);
}

// CRITICAL: Cleanup in shutdown()
shutdown(): void {
  EventBus.off(GameEvents.UI_PANEL_OPEN, this._onPanelOpen);
}
```

**Available Game Events** (see [src/types/events.ts](src/types/events.ts)):
- `PLAYER_DAMAGED`, `PLAYER_HEALED`, `SCRAP_CHANGED`, `CHIP_CHANGED`
- `UI_PANEL_OPEN`, `DIALOGUE_STARTED`, `SETTINGS_CHANGED`
- `ACHIEVEMENT_UNLOCKED`, `SKILL_UNLOCKED`
- ~40+ total events covering all game domains

---

## 5. Main Menu Structure

### MainMenuScene ([src/scenes/MainMenuScene.ts](src/scenes/MainMenuScene.ts))

**Architecture:**
- Parallax animated background layers
- Floating fireflies with tweens
- Logo with fade-in animation
- Dynamic button layout based on save state

**Button Creation Pattern:**
```typescript
private menuButton(label: string, x: number, y: number, onClick: () => void): void {
  const bg = this.add.rectangle(x, y, 220, 40, 0x1a2a1a, 0.85)
    .setInteractive({ cursor: 'pointer' });
  
  const text = this.add.text(x, y, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    color: '#c8e6c2',
  }).setOrigin(0.5);

  // Hover effects
  bg.on('pointerover', () => {
    this.tweens.add({ targets: [bg, text], scaleX: 1.04, scaleY: 1.04, duration: 80 });
    bg.setFillStyle(0x2a3e2a, 0.95);
  });

  // Click handling
  bg.on('pointerup', () => {
    this.tweens.add({ targets: [bg, text], scaleX: 1, scaleY: 1, duration: 80 });
    onClick();
  });
}
```

**Available Menu Options:**
- "Continue" (if save exists)
- "New Game" (with confirmation dialog)
- "Settings" (launches UIScene in 'settings' mode)
- "Credits" (inline overlay)
- Version display

**Navigation:**
```
Main Menu → Continue → HubScene → GameScene (with UIScene)
Main Menu → New Game → HubScene
Main Menu → Settings → UIScene (palette: settings)
Main Menu → Credits → Inline overlay
```

---

## 6. UI Integration with Scenes

### From MainMenuScene to Settings:
```typescript
private openSettings(): void {
  EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'settings' });
  if (!this.scene.isActive('UIScene')) {
    // If UIScene isn't running, launch it
    this.scene.launch('UIScene', { mode: 'settings' });
  }
}
```

### From GameScene:
```typescript
// UIScene launches automatically in parallel
this.scene.launch('UIScene', { gameScene: this });

// Later, other systems emit events to open panels
EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'skilltree' });
```

### From HubScene:
```typescript
private talkToNPC(npcId: string): void {
  // Trigger dialogue and open UI panel
  EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'dialogue', npcId });
}
```

---

## 7. Existing UI Panel Examples

### 1. **DialogueBox** ([src/ui/DialogueBox.ts](src/ui/DialogueBox.ts))
- **Purpose:** Display NPC dialogue with typewriter effect
- **Pattern:** Continuous typewriter animation, advance with E/click
- **Data:** Takes `DialogueNode[]` array
- **Style:** Bottom panel, speaker name + body text

### 2. **SettingsUI** ([src/ui/SettingsUI.ts](src/ui/SettingsUI.ts))
- **Purpose:** Audio/display/accessibility settings
- **Pattern:** Tabbed interface with dynamic content
- **Integration:** Calls `SettingsManager.set()` on changes
- **Tabs:** audio, display, accessibility
- **Controls:** Sliders (volume) and toggles (fullscreen, colorblind mode)

### 3. **SkillTreeUI** ([src/ui/SkillTreeUI.ts](src/ui/SkillTreeUI.ts))
- **Purpose:** Visualize and unlock skills
- **Pattern:** Graph visualization with node colors
- **Data:** Loads `SkillTreeDefinition` from content
- **Interactions:** Click to unlock (with point cost)
- **State:** Syncs with `ProgressionService`

### 4. **PrestigeAltarUI** ([src/ui/PrestigeAltarUI.ts](src/ui/PrestigeAltarUI.ts))
- **Purpose:** Claim prestige rewards after milestone runs
- **Pattern:** List of claimable tracks with descriptions
- **Integration:** Calls `PrestigeService.claimTrack()`
- **Data:** Filtered by `getClaimableTracks()`

### 5. **ChipTerminalUI** ([src/ui/ChipTerminalUI.ts](src/ui/ChipTerminalUI.ts))
- **Purpose:** Select a chip to install during run
- **Pattern:** 3-card display with fly-in animation
- **Data:** Random draw from `ItemPoolService`
- **Integration:** Updates `runState.appliedChipIds`

### 6. **BlacksmithUI** ([src/ui/BlacksmithUI.ts](src/ui/BlacksmithUI.ts))
- **Purpose:** Buy items from Humphrey's shop
- **Pattern:** Card grid with NPC quotes
- **Data:** Items drawn per biome/act/luck
- **Integration:** Spends run scraps via `CurrencyManager`

---

## 8. Pattern for Creating New Screens

### Step-by-Step: Creating a "Help" Screen

#### Step 1: Create the UI Class
Create [src/ui/HelpUI.ts](src/ui/HelpUI.ts):

```typescript
import Phaser from 'phaser';

const DEPTH = 200;

export class HelpUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open: boolean = false;
  private currentPage: number = 0;
  private totalPages: number = 3;  // Adjust as needed

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.currentPage = 0;  // Reset to first page
      this.build();
    } else {
      this.container.setVisible(false);
    }
  }

  private build(): void {
    this.container.removeAll(true);
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    const panW = 520;
    const panH = 420;

    // Background panel
    this.container.add(
      this.scene.add.rectangle(cx, cy, panW, panH, 0x000000, 0.93)
        .setStrokeStyle(1, 0x446644)
    );

    // Title
    this.container.add(
      this.scene.add.text(cx, cy - panH / 2 + 22, 'HELP & GUIDE', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#74C69D',
      }).setOrigin(0.5)
    );

    // Page indicator
    const pageText = this.scene.add.text(cx, cy + panH / 2 - 25, `Page ${this.currentPage + 1} of ${this.totalPages}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#668866',
    }).setOrigin(0.5);
    this.container.add(pageText);

    // Content for current page
    this.buildPageContent(cx, cy, panW, panH);

    // Navigation buttons
    if (this.currentPage > 0) {
      const prevBtn = this.scene.add.text(cx - 120, cy + panH / 2 - 25, '[ PREVIOUS ]', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#74C69D',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
      prevBtn.on('pointerup', () => {
        this.currentPage--;
        this.build();
      });
      this.container.add(prevBtn);
    }

    if (this.currentPage < this.totalPages - 1) {
      const nextBtn = this.scene.add.text(cx + 120, cy + panH / 2 - 25, '[ NEXT ]', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#74C69D',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
      nextBtn.on('pointerup', () => {
        this.currentPage++;
        this.build();
      });
      this.container.add(nextBtn);
    }

    // Close button
    const closeBtn = this.scene.add.text(cx + panW / 2 - 16, cy - panH / 2 + 15, '×', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#aa4444',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.toggle());
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }

  private buildPageContent(cx: number, cy: number, panW: number, panH: number): void {
    const contentY = cy - 140;
    const pages = [
      {
        title: 'MOVEMENT & INTERACTION',
        lines: [
          'WASD/Arrows: Move around',
          'Left Click: Interact/attack',
          'E: Talk to NPCs / Advance dialogue',
          'ESC: Pause game',
        ],
      },
      {
        title: 'COMBAT BASICS',
        lines: [
          'Tap to attack in direction faced',
          'Dodge by dashing (stamina cost)',
          'Collect scraps (⚙) for upgrades',
          'Install chips (◈) for power-ups',
        ],
      },
      {
        title: 'HUB & PROGRESSION',
        lines: [
          'Visit Elderwick for lore',
          'Shop at Humphrey\'s Forge',
          'Unlock skills in Skill Archive',
          'Claim prestige rewards at Altar',
        ],
      },
    ];

    if (this.currentPage < pages.length) {
      const page = pages[this.currentPage];
      this.container.add(
        this.scene.add.text(cx, contentY, page.title, {
          fontFamily: 'Georgia, serif',
          fontSize: '15px',
          color: '#d4c88a',
        }).setOrigin(0.5)
      );

      page.lines.forEach((line, i) => {
        this.container.add(
          this.scene.add.text(cx - 200, contentY + 40 + i * 35, line, {
            fontFamily: 'Georgia, serif',
            fontSize: '12px',
            color: '#c8e6c2',
            wordWrap: { width: 400 },
          })
        );
      });
    }
  }
}
```

#### Step 2: Integrate into UIScene
Modify [src/scenes/UIScene.ts](src/scenes/UIScene.ts):

```typescript
import { HelpUI } from '@/ui/HelpUI';

export class UIScene extends Phaser.Scene {
  // ... existing code ...
  private helpUI!: HelpUI;
  private _onPanelOpen!: (d: { mode: UIMode; ... }) => void;

  create(data?: { mode?: UIMode; ... }): void {
    // ... existing HUD and panel creation ...
    this.helpUI = new HelpUI(this);  // Add this line
    
    this.wireEvents();
    // ... rest of create ...
  }

  private openPanel(mode: UIMode, data?: { ... }): void {
    switch (mode) {
      case 'settings':  this.settingsUI.toggle();  break;
      case 'skilltree': this.skillTreeUI.toggle();  break;
      case 'prestige':  this.prestigeUI.toggle();   break;
      case 'help':      this.helpUI.toggle();       break;  // Add this
      case 'dialogue':
        if (data?.node) this.dialogueBox.play([data.node]);
        break;
    }
  }
}
```

Then update the `UIMode` type at the top of UIScene:
```typescript
type UIMode = 'hud' | 'settings' | 'skilltree' | 'prestige' | 'dialogue' | 'help';  // Add 'help'
```

#### Step 3: Add Menu Option
To add "Help" button to main menu, modify [src/scenes/MainMenuScene.ts](src/scenes/MainMenuScene.ts):

```typescript
private buildButtons(cx: number): void {
  let y = 340;
  const gap = 52;

  if (this.hasSave) {
    this.menuButton('Continue', cx, y, () => this.scene.start('HubScene'));
    y += gap;
  }

  this.menuButton('New Game', cx, y, () => this.startNewGame());
  y += gap;
  this.menuButton('Settings', cx, y, () => this.openSettings());
  y += gap;
  this.menuButton('Help', cx, y, () => this.openHelp());  // Add this
  y += gap;
  this.menuButton('Credits', cx, y, () => this.showCredits());
}

private openHelp(): void {
  EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'help' });
  if (!this.scene.isActive('UIScene')) {
    this.scene.launch('UIScene', { mode: 'help' });
  }
}
```

#### Step 4: Add Help Access from HubScene
Optionally add Help button to [src/scenes/HubScene.ts](src/scenes/HubScene.ts):

```typescript
private async create(): Promise<void> {
  // ... existing hub setup ...
  
  // Add Help button in top-right
  const helpBtn = this.add.text(width - 30, 20, '?', {
    fontFamily: 'Georgia, serif',
    fontSize: '24px',
    color: '#74C69D',
  }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
  
  helpBtn.on('pointerup', () => {
    EventBus.emit(GameEvents.UI_PANEL_OPEN, { mode: 'help' });
  });
}
```

#### Step 5 (Optional): Add New Event Type
For tracking help access, you can add to [src/types/events.ts](src/types/events.ts):

```typescript
export const GameEvents = {
  // ... existing ...
  // Help & UI
  HELP_VIEWED: 'ui:help_viewed',
  // ... rest ...
};
```

---

## 9. Where to Add Help Screen

### Option A: Main Menu (Recommended for Initial Implementation)
- Add button in `MainMenuScene.buildButtons()`
- Creates UIScene on demand
- Available before/after new game
- **Best for:** Quick access, tutorial point

### Option B: Hub Scene
- Add button in top corner of `HubScene.create()`
- Available during hub exploration
- **Best for:** In-game help reference

### Option C: Pause Menu
- Add button in `UIScene.showPauseMenu()`
- Available during gameplay
- **Best for:** Context-sensitive help

### Option D: Dynamic (All of the Above)
- Create Help button factory in `ButtonFactory.ts`
- Reuse across multiple scenes
- **Best for:** Consistency

---

## 10. Common UI Patterns & Best Practices

### ✅ DO's:
1. **Use EventBus for cross-scene communication** — no direct scene references
2. **Store UI elements in containers** — easier to hide/destroy everything
3. **Implement cleanup in shutdown()** — remove all EventBus listeners
4. **Use setDepth() and setScrollFactor(0)** — ensure UI stays on top/visible
5. **Lazy-build in toggle/build()** — only render when shown
6. **Remove all children with removeAll(true)** — prevents memory leaks
7. **Use consistent styling** — fonts (Georgia serif), colors (#74C69D, #c8e6c2)
8. **Test scene transitions** — ensure UIScene persists or properly initializes

### ❌ DON'Ts:
1. **Don't reference scenes directly** — use EventBus only
2. **Don't create UI in update()** — causes performance issues
3. **Don't forget cleanup** — leaking EventBus listeners
4. **Don't use hardcoded positions** — calculate from scale.width/height
5. **Don't mix scene UI with modal panels** — keep layers separate
6. **Don't destroy containers without setVisible(false) first** — cleaner UX

---

## 11. Event Flow Example: Opening Settings from Game

```
GameScene (pause)
    ↓
Player presses ESC
    ↓
UIScene detects key, calls togglePause()
    ↓
GameScene.scene.pause() [suspends game loop]
    ↓
UIScene.showPauseMenu() [creates pause panel locally + Settings button]
    ↓
Player clicks Settings
    ↓
EventBus.emit(UI_PANEL_OPEN, { mode: 'settings' })
    ↓
UIScene._onPanelOpen listener receives event
    ↓
UIScene.openPanel('settings') [switch routes to settingsUI.toggle()]
    ↓
SettingsUI.build() [renders tabs and controls]
    ↓
SettingsUI container becomes visible at depth 200
```

---

## 12. File Structure Summary

```
src/
├── scenes/
│   ├── MainMenuScene.ts      ← Entry point, menu button layout
│   ├── HubScene.ts           ← Safe area, NPC interactions
│   ├── GameScene.ts          ← Gameplay loop
│   ├── UIScene.ts            ← Floating UI layer, panel router
│   ├── BootScene.ts
│   └── PreloadScene.ts
├── ui/
│   ├── SettingsUI.ts         ← Tabbed settings panel
│   ├── SkillTreeUI.ts        ← Graph visualization
│   ├── PrestigeAltarUI.ts    ← Prestige rewards
│   ├── DialogueBox.ts        ← NPC dialogue with typewriter
│   ├── ChipTerminalUI.ts     ← Chip selection menu
│   ├── BlacksmithUI.ts       ← Item shop
│   ├── HelpUI.ts             ← [TO BE CREATED] Help/guide
│   ├── Minimap.ts
│   ├── BossHealthBar.ts
│   ├── AchievementToast.ts
│   └── ButtonFactory.ts
├── types/
│   └── events.ts             ← Event constants (50+ events)
└── systems/
    └── EventBus.ts           ← Global pub/sub
```

---

## Summary

**UI Architecture:**
- Phaser 3 scene-based multi-layer system
- UIScene runs parallel to game/hub scenes
- All panels are reusable toggle-able classes
- EventBus provides loose coupling
- Fixed camera + depth sorting ensures visibility

**Creating New Screens:**
1. Create class in `src/ui/NewUI.ts`
2. Instantiate in `UIScene.create()`
3. Add case to `UIScene.openPanel()` switch
4. Update `UIMode` type
5. Emit `GameEvents.UI_PANEL_OPEN` from appropriate scene

**Help Screen Integration:**
- **Main Menu:** Add button in `MainMenuScene.buildButtons()`
- **Hub:** Optional button in top corner
- **Pause Menu:** Optional button in pause overlay
- All route through UIScene via EventBus events
