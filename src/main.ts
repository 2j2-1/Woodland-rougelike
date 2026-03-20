import Phaser from 'phaser';
import { BootScene }     from '@/scenes/BootScene';
import { PreloadScene }  from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { HubScene }      from '@/scenes/HubScene';
import { GameScene }     from '@/scenes/GameScene';
import { UIScene }       from '@/scenes/UIScene';
import { DevScene }      from '@/scenes/DevScene';
import { registerDefaultBehaviours } from '@/ai/BehaviourRegistry';

registerDefaultBehaviours();

// ── Global error logging ──────────────────────────────────────────────────────
// Paste the output of these into bug reports so crashes can be reproduced.
window.onerror = (message, source, lineno, colno, error) => {
  console.error(
    `[CRASH] ${message}\n` +
    `  at ${source}:${lineno ?? '?'}:${colno ?? '?'}\n` +
    (error?.stack ? `  stack: ${error.stack}` : '')
  );
};
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as unknown;
  const msg = reason instanceof Error
    ? `${reason.message}\n  stack: ${reason.stack ?? ''}`
    : String(reason);
  console.error(`[UNHANDLED PROMISE REJECTION] ${msg}`);
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  1280,
  height: 720,
  backgroundColor: '#1a1a0a',
  pixelArt: false,
  scene: [BootScene, PreloadScene, MainMenuScene, HubScene, GameScene, UIScene, DevScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: import.meta.env.DEV,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: document.body,
  },
  audio: {
    disableWebAudio: false,
  },
};

new Phaser.Game(config);
