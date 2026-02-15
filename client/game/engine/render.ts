import { CANVAS, CTX, VIEWPORT_SIZE, CAMERA_SPEED, DEBUG } from "../constants";
import { Player, Maze } from "../types";
import { getVisibleTiles } from "../entities/maze";

export function resizeCanvas() {
  CANVAS.width = window.innerWidth;
  CANVAS.height = window.innerHeight;
}

export function getTileSize(viewportSize: number = VIEWPORT_SIZE) {
  return Math.floor(Math.min(CANVAS.width, CANVAS.height) / viewportSize);
}

export function drawTile(x: number, y: number, color: string, tileSize: number) {
  CTX.fillStyle = color;
  CTX.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tileSize), Math.ceil(tileSize));
}

export function renderViewport(
  maze: Maze,
  viewportX: number,
  viewportY: number,
  me: Player,
  subjects: Player[],
  fogged: boolean,
  viewportSize: number = VIEWPORT_SIZE
) {
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

  const TILE_SIZE = getTileSize(viewportSize);
  const half = Math.floor(viewportSize / 2);
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

  // Draw visible tiles (skip black out-of-view tiles for now)
  for (let vy = 0; vy < viewportSize; vy++) {
    for (let vx = 0; vx < viewportSize; vx++) {
      const mx = Math.floor(viewportX) + vx - half;
      const my = Math.floor(viewportY) + vy - half;
      const px = CANVAS.width / 2 + (mx - viewportX) * TILE_SIZE;
      const py = CANVAS.height / 2 + (my - viewportY) * TILE_SIZE;
      const tile = maze.tiles[my]?.[mx];

      if (!tile) {
        if (!fogged) {
          drawTile(px, py, "#111", TILE_SIZE);
        }
        continue;
      }

      let color: string;
      if (tile === "#") {
        color = fogged && isWallAdjacent(mx, my) ? "#504630" : "#111";
      } else {
        if (visible && !visible.has(`${mx},${my}`)) {
          // Skip black tiles for now, draw them after subjects
          continue;
        }
        color = "#aaa";
      }
      drawTile(px, py, color, TILE_SIZE);
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
    for (let vy = 0; vy < viewportSize; vy++) {
      for (let vx = 0; vx < viewportSize; vx++) {
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

  // Group subjects by position
  const positionGroups = new Map<string, Player[]>();
  subjects.forEach((subject) => {
    const key = `${Math.floor(subject.renderX)},${Math.floor(subject.renderY)}`;
    if (!positionGroups.has(key)) {
      positionGroups.set(key, []);
    }
    positionGroups.get(key)!.push(subject);
  });

  // Draw all subjects (including other players)
  positionGroups.forEach((playersAtPos) => {
    const count = playersAtPos.length;
    const playerSize = TILE_SIZE / 2;

    playersAtPos.forEach((subject, index) => {
      const subjectPx = CANVAS.width / 2 + (subject.renderX - viewportX) * TILE_SIZE;
      const subjectPy = CANVAS.height / 2 + (subject.renderY - viewportY) * TILE_SIZE;

      // Calculate distance-based fade for other players
      let alpha = 1.0;
      if (fogged && visible) {
        const isMe = subject === me || subject.id === me.id;
        if (!isMe) {
          const dx = subject.renderX - me.x;
          const dy = subject.renderY - me.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Fade starts at distance 1.5, fully faded at 2.5
          const fadeStart = 1.5;
          const fadeEnd = 2.5;

          if (distance > fadeStart) {
            alpha = Math.max(0, 1 - (distance - fadeStart) / (fadeEnd - fadeStart));
          }
        }
      }

      // Use player's selected color, fallback to blue for current player, red for others
      const isMe = subject === me || subject.id === me.id;
      const defaultColor = isMe ? "#1E88E5" : "#E53935";
      const baseColor = subject.color || defaultColor;

      // Calculate position based on number of players
      let offsetX: number, offsetY: number;

      if (count === 1) {
        // Single player: centered
        offsetX = TILE_SIZE / 4;
        offsetY = TILE_SIZE / 4;
      } else if (count === 2) {
        // Two players: diagonal positioning
        if (index === 0) {
          // Top-left corner
          offsetX = 0;
          offsetY = 0;
        } else {
          // Bottom-right corner
          offsetX = TILE_SIZE / 2;
          offsetY = TILE_SIZE / 2;
        }
      } else {
        // Multiple players: grid layout
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellWidth = TILE_SIZE / cols;
        const cellHeight = TILE_SIZE / rows;
        const col = index % cols;
        const row = Math.floor(index / cols);
        offsetX = col * cellWidth + (cellWidth - playerSize) / 2;
        offsetY = row * cellHeight + (cellHeight - playerSize) / 2;
      }

      // Apply alpha for fade effect
      CTX.globalAlpha = alpha;
      CTX.fillStyle = baseColor;
      CTX.fillRect(
        subjectPx + offsetX,
        subjectPy + offsetY,
        playerSize,
        playerSize
      );
      CTX.globalAlpha = 1.0; // Reset alpha
    });
  });

  // Draw black tiles on top of non-visible areas (covering subjects)
  if (fogged && visible) {
    for (let vy = 0; vy < viewportSize; vy++) {
      for (let vx = 0; vx < viewportSize; vx++) {
        const mx = Math.floor(viewportX) + vx - half;
        const my = Math.floor(viewportY) + vy - half;
        const px = CANVAS.width / 2 + (mx - viewportX) * TILE_SIZE;
        const py = CANVAS.height / 2 + (my - viewportY) * TILE_SIZE;
        const tile = maze.tiles[my]?.[mx];

        // Draw black tiles for out-of-view areas
        if (!tile || (tile !== "#" && !visible.has(`${mx},${my}`))) {
          drawTile(px, py, "#111", TILE_SIZE);
        }
      }
    }
  }
}
