import { Maze, Player } from "../types";
import { MOVE_DURATION } from "../constants";

export function movePlayer(maze: Maze, player: Player, dx: number, dy: number) {
  const targetX = player.x + dx;
  const targetY = player.y + dy;

  if (maze.tiles[targetY]?.[targetX] && maze.tiles[targetY][targetX] !== "#") {
    player.x = targetX;
    player.y = targetY;

    const startX = player.renderX;
    const startY = player.renderY;
    const startTime = performance.now();

    function animate(time: number) {
      const t = Math.min((time - startTime) / MOVE_DURATION, 1);
      player.renderX = startX + (player.x - startX) * t;
      player.renderY = startY + (player.y - startY) * t;
      if (t < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }
}

export function spawnSubject(maze: Maze, subjects: Player[]): Player | null {
  const used = subjects.map((s) => `${s.x},${s.y}`);

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.tiles[y][x] === "S") {
        const key = `${x},${y}`;
        if (!used.includes(key)) {
          const me: Player = { x, y, renderX: x, renderY: y };
          subjects.push(me);
          return me;
        }
      }
    }
  }

  return null;
}
