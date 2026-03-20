import Phaser from 'phaser';

interface AssetManifest {
  atlases: Array<{ key: string; textureUrl: string; atlasUrl: string }>;
  tilemaps: Array<{ key: string; url: string }>;
  images: Array<{ key: string; url: string }>;
  audio: Array<{ key: string; urls: string[] }>;
  fonts: Array<{ key: string; url: string }>;
}

/**
 * PreloadScene — loads all Phaser assets declared in asset-manifest.json.
 * After completion, transitions to MainMenuScene.
 */
export class PreloadScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.cameras.main.setBackgroundColor('#0a0a06');

    const bg = this.add.graphics();
    bg.fillStyle(0x111108, 1);
    bg.fillRect(cx - 200, cy - 6, 400, 12);

    this.bar = this.add.graphics();
    this.text = this.add
      .text(cx, cy + 20, 'Loading assets...', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#666655',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      this.bar.clear();
      this.bar.fillStyle(0x74c69d, 1);
      this.bar.fillRect(cx - 200, cy - 6, Math.floor(400 * value), 12);
    });

    this.load.on('fileprogress', (file: { key: string }) => {
      this.text.setText(`Loading: ${file.key}`);
    });

    // Load the asset manifest, then queue all assets
    this.load.json('asset-manifest', '/assets/asset-manifest.json');
    this.load.once('filecomplete-json-asset-manifest', (_key: string, _type: string, data: AssetManifest) => {
      this.queueAssets(data);
    });
  }

  private queueAssets(manifest: AssetManifest): void {
    for (const atlas of manifest.atlases ?? []) {
      this.load.atlas(atlas.key, atlas.textureUrl, atlas.atlasUrl);
    }
    for (const tm of manifest.tilemaps ?? []) {
      this.load.tilemapTiledJSON(tm.key, tm.url);
    }
    for (const img of manifest.images ?? []) {
      this.load.image(img.key, img.url);
    }
    // Audio is loaded separately via Howler — just pre-register keys here
    for (const font of manifest.fonts ?? []) {
      this.load.bitmapFont(font.key, font.url + '.png', font.url + '.xml');
    }
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
