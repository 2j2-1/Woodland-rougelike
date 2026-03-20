import Phaser from 'phaser';
import type { SkillTreeDefinition, SkillNode } from '@/types/content';
import { ProgressionService } from '@/systems/ProgressionService';
import { ContentLoader } from '@/systems/ContentLoader';

const DEPTH       = 200;
const NODE_RADIUS = 20;
const LOCKED_COL  = 0x555555;
const AVAIL_COL   = 0x74C69D;
const OWNED_COL   = 0x229944;
const TEXT_COL    = '#e8e8cc';

export class SkillTreeUI {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private open:      boolean = false;
  private animalId:  string  = 'bunny';

  constructor(scene: Phaser.Scene) {
    this.scene     = scene;
    this.container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0).setVisible(false);
  }

  toggle(animalId?: string): void {
    if (animalId) this.animalId = animalId;
    this.open = !this.open;
    if (this.open) this.build();
    else           this.container.setVisible(false);
  }

  private build(): void {
    this.container.removeAll(true);
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    const bg = this.scene.add.rectangle(cx, cy, 600, 480, 0x000000, 0.92).setStrokeStyle(1, 0x446644);
    this.container.add(bg);

    const title = this.scene.add.text(cx, cy - 210, 'SKILL ARCHIVE', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#74C69D',
    }).setOrigin(0.5);
    this.container.add(title);

    const pts = ProgressionService.getSkillPoints(this.animalId);
    const ptsLabel = this.scene.add.text(cx, cy - 185, `Available Points: ${pts}`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4c88a',
    }).setOrigin(0.5);
    this.container.add(ptsLabel);

    const tree = ContentLoader.getSkillTree('main');
    if (!tree) {
      this.container.add(
        this.scene.add.text(cx, cy, 'SKILL TREE DATA NOT LOADED', {
          fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc4422',
        }).setOrigin(0.5),
      );
    } else {
      this.drawTree(tree, cx, cy);
    }

    const closeBtn = this.scene.add.text(cx + 265, cy - 215, '×', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#aa4444',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerup', () => this.toggle());
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }

  private drawTree(tree: SkillTreeDefinition, cx: number, cy: number): void {
    const nodeMap = new Map(tree.nodes.map(n => [n.id, n]));
    const owned   = new Set(tree.nodes.map(n => n.id).filter(id => ProgressionService.isUnlocked(this.animalId, id)));
    const cols    = this.layoutColumns(tree.nodes);

    const colW    = 110;
    const rowH    = 70;
    const startX  = cx - ((cols.length - 1) * colW) / 2;
    const startY  = cy - 60;

    const positions = new Map<string, { x: number; y: number }>();

    cols.forEach((nodes, ci) => {
      nodes.forEach((node, ri) => {
        const x = startX + ci * colW;
        const y = startY + (ri - (nodes.length - 1) / 2) * rowH;
        positions.set(node.id, { x, y });
      });
    });

    // Draw connections first
    const g = this.scene.add.graphics();
    this.container.add(g);
    tree.nodes.forEach(node => {
      (node.requires ?? []).forEach(reqId => {
        const a = positions.get(reqId);
        const b = positions.get(node.id);
        if (!a || !b) return;
        g.lineStyle(2, 0x336633, 0.5);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokePath();
      });
    });

    // Draw nodes
    tree.nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      const isOwned     = owned.has(node.id);
      const isAvailable = this.canUnlock(node, owned, nodeMap);
      const colour      = isOwned ? OWNED_COL : isAvailable ? AVAIL_COL : LOCKED_COL;

      const circle = this.scene.add.circle(pos.x, pos.y, NODE_RADIUS, colour, 0.9)
        .setStrokeStyle(1, 0x668866);
      this.container.add(circle);

      const label = this.scene.add.text(pos.x, pos.y + NODE_RADIUS + 6, node.name, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: TEXT_COL,
      }).setOrigin(0.5);
      this.container.add(label);

      if (!isOwned && isAvailable) {
        circle.setInteractive({ cursor: 'pointer' });
        circle.on('pointerup', () => {
          const prereq = node.requires?.[0] ?? null;
          if (ProgressionService.unlockSkill(this.animalId, node.id, prereq)) {
            this.build(); // Rebuild to reflect new state
          }
        });
        circle.on('pointerover', () => this.showTooltip(pos.x, pos.y, node));
        circle.on('pointerout',  () => this.hideTooltip());
      }
    });
  }

  private tooltipContainer?: Phaser.GameObjects.Container;
  private showTooltip(x: number, y: number, node: SkillNode): void {
    this.hideTooltip();
    const bg   = this.scene.add.rectangle(x, y - 60, 160, 56, 0x0a0a08, 0.95).setStrokeStyle(1, 0x446644);
    const name = this.scene.add.text(x, y - 75, node.name, { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#74C69D' }).setOrigin(0.5);
    const desc = this.scene.add.text(x, y - 58, node.description, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8c8aa', wordWrap: { width: 150 },
    }).setOrigin(0.5);
    this.tooltipContainer = this.scene.add.container(0, 0, [bg, name, desc]).setDepth(DEPTH + 10).setScrollFactor(0);
    this.container.add(this.tooltipContainer);
  }
  private hideTooltip(): void {
    this.tooltipContainer?.destroy();
    this.tooltipContainer = undefined;
  }

  private canUnlock(node: SkillNode, _owned: Set<string>, _nodeMap: Map<string, SkillNode>): boolean {
    const prereq = node.requires?.[0] ?? null;
    return ProgressionService.canUnlockSkill(this.animalId, node.id, prereq);
  }

  private layoutColumns(nodes: SkillNode[]): SkillNode[][] {
    const depthMap = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      const node = nodes.find(n => n.id === id);
      if (!node || !node.requires?.length) { depthMap.set(id, 0); return 0; }
      const d = Math.max(...node.requires.map(r => getDepth(r) + 1));
      depthMap.set(id, d);
      return d;
    };
    nodes.forEach(n => getDepth(n.id));
    const cols: SkillNode[][] = [];
    depthMap.forEach((d, id) => {
      while (cols.length <= d) cols.push([]);
      cols[d].push(nodes.find(n => n.id === id)!);
    });
    return cols;
  }

  isOpen(): boolean { return this.open; }
}
