import type { UIScene } from '@/scenes/UIScene';
import type { RunGraph, Direction } from '@/systems/RunGraph';

const CELL    = 8;  // px per room cell on minimap
const PAD     = 4;  // padding inside panel
const ROOMS_W = 9;
const ROOMS_H = 9;
const PANEL_W = ROOMS_W * CELL + PAD * 2;
const PANEL_H = ROOMS_H * CELL + PAD * 2;
const HALF    = CELL / 2;

export class Minimap {
  private panel:    Phaser.GameObjects.Rectangle;
  private graphics: Phaser.GameObjects.Graphics;
  private ox:       number;
  private oy:       number;

  /** rooms that have been visited: "col,row" */
  private visited: Set<string> = new Set();
  /** rooms that have been cleared */
  private cleared: Set<string> = new Set();

  /** Current room in the grid */
  private currentCol = 4;
  private currentRow = 4;

  /** Run graph reference for drawing corridors between known rooms. */
  private graph?: RunGraph;

  constructor(scene: UIScene) {
    const { width } = scene.scale;
    // Top-right corner
    this.ox = width - PANEL_W - 12;
    this.oy = 12;

    this.panel = scene.add
      .rectangle(this.ox + PANEL_W / 2, this.oy + PANEL_H / 2, PANEL_W, PANEL_H, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(90);
    this.panel.setStrokeStyle(1, 0x446644, 0.9);

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(91);

    // Mark start room visited
    this.markVisited(this.currentCol, this.currentRow);
    this.draw();
  }

  /** Call once after the run graph is generated so corridors can be rendered. */
  setGraph(graph: RunGraph): void {
    this.graph = graph;
    this.draw();
  }

  markVisited(col: number, row: number): void {
    this.visited.add(`${col},${row}`);
    this.draw();
  }

  markCleared(col: number, row: number): void {
    this.cleared.add(`${col},${row}`);
    this.draw();
  }

  moveTo(col: number, row: number): void {
    this.currentCol = col;
    this.currentRow = row;
    this.markVisited(col, row);
  }

  /** Called each frame by UIScene; redraws only if dirty. */
  update(): void {
    // Rendering is event-driven via markVisited/moveTo;
    // this hook exists for UIScene compatibility.
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    // Draw corridors between visited rooms (only connections both players know about)
    if (this.graph) {
      g.lineStyle(1, 0x336633, 0.6);
      for (const room of this.graph.allRooms()) {
        const fromKey = `${room.col},${room.row}`;
        if (!this.visited.has(fromKey)) continue;

        const fx = this.ox + PAD + room.col * CELL + HALF;
        const fy = this.oy + PAD + room.row * CELL + HALF;

        for (const dir of Object.keys(room.exits) as Direction[]) {
          const targetId = room.exits[dir]!;
          const target   = this.graph.getRoom(targetId);
          if (!target) continue;
          const toKey = `${target.col},${target.row}`;
          if (!this.visited.has(toKey)) continue;

          const tx = this.ox + PAD + target.col * CELL + HALF;
          const ty = this.oy + PAD + target.row * CELL + HALF;
          g.lineBetween(fx, fy, tx, ty);
        }
      }
    }

    // Draw room squares
    for (let r = 0; r < ROOMS_H; r++) {
      for (let c = 0; c < ROOMS_W; c++) {
        const key = `${c},${r}`;
        if (!this.visited.has(key)) continue;

        const x = this.ox + PAD + c * CELL;
        const y = this.oy + PAD + r * CELL;

        const isCurrent = c === this.currentCol && r === this.currentRow;
        const isCleared = this.cleared.has(key);

        const fillColour = isCurrent ? 0x74C69D : isCleared ? 0x224422 : 0x445544;
        const alpha      = isCurrent ? 1.0 : 0.8;

        g.fillStyle(fillColour, alpha);
        g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

        // Border
        g.lineStyle(1, isCurrent ? 0x99eebb : 0x336633, 0.7);
        g.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.graphics.setVisible(visible);
  }
}
