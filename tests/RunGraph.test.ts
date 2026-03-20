import { describe, it, expect } from 'vitest';
import { RunGraph, OPPOSITE_DIR } from '@/systems/RunGraph';
import type { RoomNode, Direction } from '@/systems/RunGraph';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** BFS from startId; returns set of reachable room ids. */
function reachable(graph: RunGraph, startId: string): Set<string> {
  const visited = new Set<string>();
  const queue   = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = graph.getRoom(id)!;
    for (const neighbourId of Object.values(node.exits) as string[]) {
      if (!visited.has(neighbourId)) queue.push(neighbourId);
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RunGraph generation', () => {
  it('generates between 2 and 12 rooms', () => {
    for (let seed = 0; seed < 10; seed++) {
      const graph = new RunGraph(seed);
      const rooms = graph.allRooms();
      expect(rooms.length).toBeGreaterThanOrEqual(2);
      expect(rooms.length).toBeLessThanOrEqual(12);
    }
  });

  it('always generates a valid startId', () => {
    const graph = new RunGraph(42);
    const startNode = graph.getRoom(graph.startId);
    expect(startNode).toBeDefined();
    expect(startNode!.id).toBe(graph.startId);
  });

  it('start room is at grid position (4, 4)', () => {
    const graph = new RunGraph(99);
    const start = graph.getRoom(graph.startId)!;
    expect(start.col).toBe(4);
    expect(start.row).toBe(4);
  });

  it('all rooms are reachable from start', () => {
    for (let seed = 0; seed < 20; seed++) {
      const graph   = new RunGraph(seed);
      const allIds  = graph.allRooms().map((r) => r.id);
      const reached = reachable(graph, graph.startId);
      for (const id of allIds) {
        expect(reached.has(id), `Room ${id} unreachable (seed ${seed})`).toBe(true);
      }
    }
  });

  it('each room has at most 3 exits', () => {
    for (let seed = 0; seed < 15; seed++) {
      const graph = new RunGraph(seed);
      for (const room of graph.allRooms()) {
        const exitCount = Object.keys(room.exits).length;
        expect(exitCount).toBeLessThanOrEqual(3);
      }
    }
  });

  it('each room has at least 1 exit', () => {
    for (let seed = 0; seed < 15; seed++) {
      const graph = new RunGraph(seed);
      for (const room of graph.allRooms()) {
        const exitCount = Object.keys(room.exits).length;
        expect(exitCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('exit directions are valid Direction values', () => {
    const validDirs = new Set<string>(['N', 'S', 'E', 'W']);
    const graph     = new RunGraph(7);
    for (const room of graph.allRooms()) {
      for (const dir of Object.keys(room.exits)) {
        expect(validDirs.has(dir)).toBe(true);
      }
    }
  });

  it('all exit target ids exist in the graph', () => {
    const graph = new RunGraph(3);
    for (const room of graph.allRooms()) {
      for (const targetId of Object.values(room.exits) as string[]) {
        expect(graph.getRoom(targetId)).toBeDefined();
      }
    }
  });

  it('connections are bidirectional with opposite directions', () => {
    const graph = new RunGraph(17);
    for (const room of graph.allRooms()) {
      for (const [dir, targetId] of Object.entries(room.exits) as [Direction, string][]) {
        const target  = graph.getRoom(targetId)!;
        const backDir = OPPOSITE_DIR[dir];
        expect(
          target.exits[backDir],
          `${targetId}.exits[${backDir}] should point back to ${room.id}`,
        ).toBe(room.id);
      }
    }
  });

  it('no two rooms occupy the same grid cell', () => {
    for (let seed = 0; seed < 10; seed++) {
      const graph = new RunGraph(seed);
      const cells = new Set<string>();
      for (const room of graph.allRooms()) {
        const key = `${room.col},${room.row}`;
        expect(cells.has(key), `Duplicate cell ${key} (seed ${seed})`).toBe(false);
        cells.add(key);
      }
    }
  });

  it('all rooms have a non-empty enemy pool', () => {
    const graph = new RunGraph(55);
    for (const room of graph.allRooms()) {
      expect(room.enemyPool.length).toBeGreaterThan(0);
    }
  });

  it('enemy pools vary across rooms (not all identical)', () => {
    const graph  = new RunGraph(8);
    const rooms  = graph.allRooms();
    const pools  = rooms.map((r) => r.enemyPool.join(','));
    const unique = new Set(pools);
    // With 12 rooms cycling through 12 pools, every pool should appear exactly once
    expect(unique.size).toBeGreaterThan(1);
  });

  it('markCleared sets cleared flag on the room', () => {
    const graph = new RunGraph(1);
    const room  = graph.getRoom(graph.startId)!;
    expect(room.cleared).toBe(false);
    graph.markCleared(graph.startId);
    expect(room.cleared).toBe(true);
  });

  it('markCleared is idempotent', () => {
    const graph = new RunGraph(2);
    graph.markCleared(graph.startId);
    graph.markCleared(graph.startId);
    expect(graph.getRoom(graph.startId)!.cleared).toBe(true);
  });

  it('markCleared on unknown id does nothing', () => {
    const graph = new RunGraph(4);
    expect(() => graph.markCleared('nonexistent-room')).not.toThrow();
  });

  it('same seed produces identical graph', () => {
    const g1 = new RunGraph(12345);
    const g2 = new RunGraph(12345);

    const rooms1 = g1.allRooms().map((r): RoomNode => ({ ...r, exits: { ...r.exits } }));
    const rooms2 = g2.allRooms().map((r): RoomNode => ({ ...r, exits: { ...r.exits } }));

    expect(rooms1.length).toBe(rooms2.length);
    for (let i = 0; i < rooms1.length; i++) {
      expect(rooms1[i].id).toBe(rooms2[i].id);
      expect(rooms1[i].col).toBe(rooms2[i].col);
      expect(rooms1[i].row).toBe(rooms2[i].row);
      expect(rooms1[i].exits).toEqual(rooms2[i].exits);
    }
  });

  it('different seeds usually produce different graphs', () => {
    const g1     = new RunGraph(0);
    const g2     = new RunGraph(9999);
    const cells1 = g1.allRooms().map((r) => `${r.col},${r.row}`).sort().join('|');
    const cells2 = g2.allRooms().map((r) => `${r.col},${r.row}`).sort().join('|');
    // Very unlikely both produce identical layouts
    expect(cells1).not.toBe(cells2);
  });
});

describe('OPPOSITE_DIR', () => {
  it.each([
    ['N', 'S'],
    ['S', 'N'],
    ['E', 'W'],
    ['W', 'E'],
  ] as [Direction, Direction][])('OPPOSITE_DIR[%s] === %s', (dir: Direction, expected: Direction) => {
    expect(OPPOSITE_DIR[dir]).toBe(expected);
  });
});
