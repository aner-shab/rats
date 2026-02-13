import { Maze } from "../types";

export async function loadMaze(url: string): Promise<Maze> {
  const res = await fetch(url);
  const data = await res.json();
  return data as Maze;
}

export function getVisibleTiles(
  maze: Maze,
  startX: number,
  startY: number,
  maxDepth = 2
): Set<string> {
  const visible = new Set<string>();
  const queue = [{ x: startX, y: startY, d: 0 }];

  while (queue.length > 0) {
    const { x, y, d } = queue.shift()!;
    const key = `${x},${y}`;
    if (visible.has(key)) continue;
    visible.add(key);
    if (d === maxDepth) continue;

    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    for (const n of neighbors) {
      if (maze.tiles[n.y]?.[n.x] && maze.tiles[n.y][n.x] !== "#") {
        queue.push({ x: n.x, y: n.y, d: d + 1 });
      }
    }
  }

  return visible;
}
