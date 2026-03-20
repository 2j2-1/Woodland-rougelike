/**
 * RunGraph — procedurally generates a maze-like graph of rooms for one run.
 *
 * Rooms are placed on a 9×9 grid. Each room has 1–3 exits in cardinal
 * directions; not every direction gets an exit, creating a maze-like layout.
 * Rooms are always fully connected (every room is reachable from the start).
 */

export type Direction = 'N' | 'S' | 'E' | 'W';

export interface RoomNode {
  id: string;
  col: number;
  row: number;
  /** Key = direction, value = id of the adjacent room */
  exits: Partial<Record<Direction, string>>;
  /** Enemy IDs to spawn in wave 1 of this room */
  enemyPool: string[];
  cleared: boolean;
}

/** Maps each direction to its opposite. */
export const OPPOSITE_DIR: Record<Direction, Direction> = {
  N: 'S', S: 'N', E: 'W', W: 'E',
};

const DELTA: Record<Direction, { dc: number; dr: number }> = {
  N: { dc:  0, dr: -1 },
  S: { dc:  0, dr:  1 },
  E: { dc:  1, dr:  0 },
  W: { dc: -1, dr:  0 },
};

const ALL_DIRS: Direction[] = ['N', 'S', 'E', 'W'];

const GRID_SIZE    = 9;
const TARGET_ROOMS = 12;
const MAX_EXITS    = 3; // most rooms have 1–3 exits; never all 4

/** Pre-defined enemy combos cycled by room index for variety. */
const ENEMY_POOLS: string[][] = [
  ['robo-pheasant-mk1', 'robo-pheasant-mk1'],
  ['badger-bot-3000',   'robo-pheasant-mk1'],
  ['forest-drone',      'forest-drone'],
  ['bramble-golem'],
  ['robo-pheasant-mk1', 'badger-bot-3000', 'forest-drone'],
  ['shadow-vole',       'shadow-vole'],
  ['badger-bot-3000',   'badger-bot-3000'],
  ['forest-drone',      'robo-pheasant-mk1'],
  ['shadow-vole',       'robo-pheasant-mk1'],
  ['bramble-golem',     'forest-drone'],
  ['robo-pheasant-mk1', 'robo-pheasant-mk1', 'forest-drone'],
  ['badger-bot-3000',   'shadow-vole'],
];

export class RunGraph {
  readonly startId: string;
  private rooms: Map<string, RoomNode> = new Map();
  /** Grid lookup: "col,row" → roomId */
  private grid: Map<string, string> = new Map();

  constructor(seed?: number) {
    this.startId = this.generate(seed ?? ((Math.random() * 0x100000000) >>> 0));
  }

  getRoom(id: string): RoomNode | undefined {
    return this.rooms.get(id);
  }

  allRooms(): RoomNode[] {
    return [...this.rooms.values()];
  }

  markCleared(id: string): void {
    const room = this.rooms.get(id);
    if (room) room.cleared = true;
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  private generate(seed: number): string {
    // LCG random number generator (reproducible from seed)
    let s = seed >>> 0;
    const rng = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };

    const addRoom = (col: number, row: number): RoomNode => {
      const id = `room-${this.rooms.size}`;
      const poolIdx = this.rooms.size % ENEMY_POOLS.length;
      const node: RoomNode = {
        id,
        col,
        row,
        exits: {},
        enemyPool: [...ENEMY_POOLS[poolIdx]],
        cleared: false,
      };
      this.rooms.set(id, node);
      this.grid.set(`${col},${row}`, id);
      return node;
    };

    // Centre of the 9×9 grid
    const start = addRoom(4, 4);
    const frontier: RoomNode[] = [start];

    while (frontier.length > 0 && this.rooms.size < TARGET_ROOMS) {
      const fi = Math.floor(rng() * frontier.length);
      const current = frontier[fi];
      const numExits = Object.keys(current.exits).length;

      // Find neighbouring cells that are empty and within grid bounds
      const available = ALL_DIRS.filter((dir) => {
        if (numExits >= MAX_EXITS) return false;
        if (dir in current.exits) return false;
        const { dc, dr } = DELTA[dir];
        const nc = current.col + dc;
        const nr = current.row + dr;
        if (nc < 0 || nc >= GRID_SIZE || nr < 0 || nr >= GRID_SIZE) return false;
        return !this.grid.has(`${nc},${nr}`);
      });

      if (available.length === 0) {
        frontier.splice(fi, 1); // exhausted; stop expanding from here
        continue;
      }

      const dir = available[Math.floor(rng() * available.length)];
      const { dc, dr } = DELTA[dir];
      const newRoom = addRoom(current.col + dc, current.row + dr);

      // Bidirectional connection
      current.exits[dir] = newRoom.id;
      newRoom.exits[OPPOSITE_DIR[dir]] = current.id;

      // 70 % chance to keep expanding from the new room (branching)
      if (rng() < 0.7) {
        frontier.push(newRoom);
      }
    }

    return start.id;
  }
}
