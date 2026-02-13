import { CANVAS, CTX, VIEWPORT_SIZE, CAMERA_SPEED, DEBUG } from "../constants";
import { Player, Maze } from "../types";
import { getVisibleTiles } from "../entities/maze";

export function resizeCanvas() {
  CANVAS.width = window.innerWidth;
  CANVAS.height = window.innerHeight;
}

export function getTileSize() {
  return Math.floor(Math.min(CANVAS.width, CANVAS.height) / VIEWPORT_SIZE);
}

export function drawTile(x: number, y: number, color: string) {
  CTX.fillStyle = color;
  const TILE_SIZE = getTileSize();
  CTX.fillRect(Math.floor(x), Math.floor(y), Math.ceil(TILE_SIZE), Math.ceil(TILE_SIZE));
}

export function renderViewport(
  maze: Maze,
  viewportX: number,
  viewportY: number,
  me: Player,
  subjects: Player[],
  fogged: boolean
) {
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

  const TILE_SIZE = getTileSize();
  const half = Math.floor(VIEWPORT_SIZE / 2);
  const visible = fogged ? getVisibleTiles(maze, me.x, me.y, 2) : null;

  function isWallAdjacent(mx: number, my: number) {
    if (!visible) return false;
    const neighbors = [
      { x: mx + 1, y: my },
      { x: mx - 1, y: my },
      { x: mx, y: my + 1 },
      { x: mx, y: my - 1 },
    ];
    return neighbors.some((n) => visible.has(`${n.x},${n.y}`));
  }

  for (let vy = 0; vy < VIEWPORT_SIZE; vy++) {
    for (let vx = 0; vx < VIEWPORT_SIZE; vx++) {
      const mx = Math.floor(viewportX) + vx - half;
      const my = Math.floor(viewportY) + vy - half;
      const px = CANVAS.width / 2 + (mx - viewportX) * TILE_SIZE;
      const py = CANVAS.height / 2 + (my - viewportY) * TILE_SIZE;
      const tile = maze.tiles[my]?.[mx];

      if (!tile) {
        drawTile(px, py, "#111");
        continue;
      }

      let color: string;
      if (tile === "#") {
        color = fogged && isWallAdjacent(mx, my) ? "#504630" : "#111";
      } else {
        if (visible && !visible.has(`${mx},${my}`)) {
          drawTile(px, py, "#111");
          continue;
        }
        color = "#aaa";
      }
      drawTile(px, py, color);
    }
  }

  // Apply smooth radial fog overlay
  if (fogged && visible) {
    const playerPx = CANVAS.width / 2 + (me.renderX - viewportX) * TILE_SIZE;
    const playerPy = CANVAS.height / 2 + (me.renderY - viewportY) * TILE_SIZE;
    const centerX = playerPx + TILE_SIZE / 2;
    const centerY = playerPy + TILE_SIZE / 2;
    const gradient = CTX.createRadialGradient(centerX, centerY, TILE_SIZE * 1.5, centerX, centerY, TILE_SIZE * 2.5);
    gradient.addColorStop(0, 'rgba(17, 17, 17, 0)');
    gradient.addColorStop(0.7, 'rgba(17, 17, 17, 0.4)');
    gradient.addColorStop(1, 'rgba(17, 17, 17, 0.8)');

    CTX.fillStyle = gradient;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
  }

  // Draw per-tile fog for distant tiles
  if (fogged && visible) {
    for (let vy = 0; vy < VIEWPORT_SIZE; vy++) {
      for (let vx = 0; vx < VIEWPORT_SIZE; vx++) {
        const mx = Math.floor(viewportX) + vx - half;
        const my = Math.floor(viewportY) + vy - half;
        const px = CANVAS.width / 2 + (mx - viewportX) * TILE_SIZE;
        const py = CANVAS.height / 2 + (my - viewportY) * TILE_SIZE;

        const dx = mx - me.x;
        const dy = my - me.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const fogStart = 1.8;
        const fogEnd = 2.5;

        if (distance > fogStart) {
          const fogAlpha = Math.min(1, (distance - fogStart) / (fogEnd - fogStart)) * 0.5;
          CTX.fillStyle = `rgba(17, 17, 17, ${fogAlpha})`;
          CTX.fillRect(Math.floor(px), Math.floor(py), Math.ceil(TILE_SIZE), Math.ceil(TILE_SIZE));
        }
      }
    }
  }

  // Draw all subjects (including other players)
  subjects.forEach((subject) => {
    const subjectPx = CANVAS.width / 2 + (subject.renderX - viewportX) * TILE_SIZE;
    const subjectPy = CANVAS.height / 2 + (subject.renderY - viewportY) * TILE_SIZE;

    // Check if subject is visible (for fogged mode)
    if (fogged && visible) {
      const subjectX = Math.floor(subject.renderX);
      const subjectY = Math.floor(subject.renderY);
      if (!visible.has(`${subjectX},${subjectY}`)) {
        return; // Skip drawing if not visible
      }
    }

    // Draw self as blue, others as red
    const isMe = subject === me || subject.id === me.id;
    CTX.fillStyle = isMe ? "blue" : "red";
    CTX.fillRect(subjectPx + TILE_SIZE / 4, subjectPy + TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);
  });
}
