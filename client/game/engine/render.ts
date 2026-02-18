import { CANVAS, CTX, VIEWPORT_SIZE, CAMERA_SPEED, DEBUG } from "../constants";
import { Player, Maze } from "../types";
import { getVisibleTiles } from "../entities/maze";

// Brick texture asset
let brickPattern: CanvasPattern | null = null;
let brickImage: HTMLImageElement | null = null;
let brickImageLoaded = false;

// Load the brick wall texture asset
function loadBrickTexture(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (brickImage && brickImageLoaded) {
      resolve(brickImage);
      return;
    }

    const img = new Image();
    img.onload = () => {
      brickImage = img;
      brickImageLoaded = true;
      resolve(img);
    };
    img.onerror = reject;
    img.src = '/assets/brick-wall.svg';
  });
}

// Initialize brick texture on module load
loadBrickTexture().catch(err => {
  console.error('Failed to load brick texture:', err);
});

export function resizeCanvas() {
  CANVAS.width = window.innerWidth;
  CANVAS.height = window.innerHeight;
}

export function getTileSize(viewportSize: number = VIEWPORT_SIZE) {
  return Math.floor(Math.min(CANVAS.width, CANVAS.height) / viewportSize);
}

export function getTileSizeForRect(viewportWidth: number, viewportHeight: number) {
  const tileSizeX = Math.floor(CANVAS.width / viewportWidth);
  const tileSizeY = Math.floor(CANVAS.height / viewportHeight);
  return Math.min(tileSizeX, tileSizeY);
}

export function drawTile(x: number, y: number, color: string, tileSize: number) {
  CTX.fillStyle = color;
  CTX.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tileSize), Math.ceil(tileSize));
}

// Simple hash function for position-based variation
function positionHash(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash);
}

export function drawBrickTile(x: number, y: number, tileSize: number, mazeX: number, mazeY: number, maze: Maze, visibleTiles?: Set<string> | null) {
  if (brickImageLoaded && brickImage) {
    // Create pattern if not already created
    if (!brickPattern) {
      brickPattern = CTX.createPattern(brickImage, 'repeat');
    }

    if (brickPattern) {
      // Save context state
      CTX.save();
      
      // Check adjacent tiles to determine which corners to cut
      const hasPathAbove = maze.tiles[mazeY - 1]?.[mazeX] && maze.tiles[mazeY - 1][mazeX] !== "#";
      const hasPathBelow = maze.tiles[mazeY + 1]?.[mazeX] && maze.tiles[mazeY + 1][mazeX] !== "#";
      const hasPathLeft = maze.tiles[mazeY]?.[mazeX - 1] && maze.tiles[mazeY][mazeX - 1] !== "#";
      const hasPathRight = maze.tiles[mazeY]?.[mazeX + 1] && maze.tiles[mazeY][mazeX + 1] !== "#";
      
      // Check diagonal tiles - don't cut corners if there's a wall diagonally
      const hasWallTopLeft = maze.tiles[mazeY - 1]?.[mazeX - 1] === "#";
      const hasWallTopRight = maze.tiles[mazeY - 1]?.[mazeX + 1] === "#";
      const hasWallBottomRight = maze.tiles[mazeY + 1]?.[mazeX + 1] === "#";
      const hasWallBottomLeft = maze.tiles[mazeY + 1]?.[mazeX - 1] === "#";
      
      // Randomly decide to cut each corner (only if BOTH adjacent sides have paths AND no diagonal wall)
      const cutSize = tileSize * 0.2; // Size of the corner cut
      const cutTopLeft = (hasPathAbove && hasPathLeft && !hasWallTopLeft) && positionHash(mazeX, mazeY) > 0.5;
      const cutTopRight = (hasPathAbove && hasPathRight && !hasWallTopRight) && positionHash(mazeX + 1, mazeY) > 0.5;
      const cutBottomRight = (hasPathBelow && hasPathRight && !hasWallBottomRight) && positionHash(mazeX + 1, mazeY + 1) > 0.5;
      const cutBottomLeft = (hasPathBelow && hasPathLeft && !hasWallBottomLeft) && positionHash(mazeX, mazeY + 1) > 0.5;
      
      // Create path with angled corners
      CTX.beginPath();
      
      // Start from top edge, accounting for top-left corner
      if (cutTopLeft) {
        CTX.moveTo(x + cutSize, y);
      } else {
        CTX.moveTo(x, y);
      }
      
      // Top edge to top-right corner
      if (cutTopRight) {
        CTX.lineTo(x + tileSize - cutSize, y);
        CTX.lineTo(x + tileSize, y + cutSize);
      } else {
        CTX.lineTo(x + tileSize, y);
      }
      
      // Right edge to bottom-right corner
      if (cutBottomRight) {
        CTX.lineTo(x + tileSize, y + tileSize - cutSize);
        CTX.lineTo(x + tileSize - cutSize, y + tileSize);
      } else {
        CTX.lineTo(x + tileSize, y + tileSize);
      }
      
      // Bottom edge to bottom-left corner
      if (cutBottomLeft) {
        CTX.lineTo(x + cutSize, y + tileSize);
        CTX.lineTo(x, y + tileSize - cutSize);
      } else {
        CTX.lineTo(x, y + tileSize);
      }
      
      // Left edge to top-left corner
      if (cutTopLeft) {
        CTX.lineTo(x, y + cutSize);
        CTX.lineTo(x + cutSize, y);
      } else {
        CTX.lineTo(x, y);
      }
      
      CTX.closePath();
      CTX.clip();

      // Translate so the pattern aligns with the tile's maze position
      // This makes the texture move with the tile, not the camera
      const offsetX = (mazeX * tileSize) % brickImage.width;
      const offsetY = (mazeY * tileSize) % brickImage.height;

      CTX.translate(x - offsetX, y - offsetY);
      CTX.fillStyle = brickPattern;
      CTX.fillRect(offsetX, offsetY, Math.ceil(tileSize), Math.ceil(tileSize));

      // Restore context state
      CTX.restore();
      
      // Fill the cut corners with path color or black based on visibility
      // Corner is black only if the adjacent tiles are not visible
      const seamFix = 1.0; // Generous overlap to prevent black seams
      
      if (cutTopLeft) {
        let cornerColor = "#aaa";
        if (visibleTiles) {
          const topVisible = visibleTiles.has(`${mazeX},${mazeY - 1}`);
          const leftVisible = visibleTiles.has(`${mazeX - 1},${mazeY}`);
          if (!topVisible || !leftVisible) {
            cornerColor = "#111"; // Black if adjacent tiles not visible
          }
        }
        CTX.fillStyle = cornerColor;
        CTX.beginPath();
        CTX.moveTo(x - seamFix, y - seamFix);
        CTX.lineTo(x + cutSize + seamFix, y - seamFix);
        CTX.lineTo(x - seamFix, y + cutSize + seamFix);
        CTX.closePath();
        CTX.fill();
      }
      
      if (cutTopRight) {
        let cornerColor = "#aaa";
        if (visibleTiles) {
          const topVisible = visibleTiles.has(`${mazeX},${mazeY - 1}`);
          const rightVisible = visibleTiles.has(`${mazeX + 1},${mazeY}`);
          if (!topVisible || !rightVisible) {
            cornerColor = "#111";
          }
        }
        CTX.fillStyle = cornerColor;
        CTX.beginPath();
        CTX.moveTo(x + tileSize + seamFix, y - seamFix);
        CTX.lineTo(x + tileSize - cutSize - seamFix, y - seamFix);
        CTX.lineTo(x + tileSize + seamFix, y + cutSize + seamFix);
        CTX.closePath();
        CTX.fill();
      }
      
      if (cutBottomRight) {
        let cornerColor = "#aaa";
        if (visibleTiles) {
          const bottomVisible = visibleTiles.has(`${mazeX},${mazeY + 1}`);
          const rightVisible = visibleTiles.has(`${mazeX + 1},${mazeY}`);
          if (!bottomVisible || !rightVisible) {
            cornerColor = "#111";
          }
        }
        CTX.fillStyle = cornerColor;
        CTX.beginPath();
        CTX.moveTo(x + tileSize + seamFix, y + tileSize + seamFix);
        CTX.lineTo(x + tileSize - cutSize - seamFix, y + tileSize + seamFix);
        CTX.lineTo(x + tileSize + seamFix, y + tileSize - cutSize - seamFix);
        CTX.closePath();
        CTX.fill();
      }
      
      if (cutBottomLeft) {
        let cornerColor = "#aaa";
        if (visibleTiles) {
          const bottomVisible = visibleTiles.has(`${mazeX},${mazeY + 1}`);
          const leftVisible = visibleTiles.has(`${mazeX - 1},${mazeY}`);
          if (!bottomVisible || !leftVisible) {
            cornerColor = "#111";
          }
        }
        CTX.fillStyle = cornerColor;
        CTX.beginPath();
        CTX.moveTo(x - seamFix, y + tileSize + seamFix);
        CTX.lineTo(x + cutSize + seamFix, y + tileSize + seamFix);
        CTX.lineTo(x - seamFix, y + tileSize - cutSize - seamFix);
        CTX.closePath();
        CTX.fill();
      }
    }
  } else {
    // Fallback to solid color if texture hasn't loaded yet
    CTX.fillStyle = "#504630";
    CTX.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tileSize), Math.ceil(tileSize));
  }
}

export function renderViewport(
  maze: Maze,
  viewportX: number,
  viewportY: number,
  me: Player,
  subjects: Player[],
  fogged: boolean,
  viewportSize: number = VIEWPORT_SIZE,
  viewportWidth?: number,
  viewportHeight?: number
) {
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

  const vWidth = viewportWidth ?? viewportSize;
  const vHeight = viewportHeight ?? viewportSize;
  const TILE_SIZE = viewportWidth && viewportHeight ? getTileSizeForRect(vWidth, vHeight) : getTileSize(viewportSize);

  // Calculate actual tiles that fit on screen (for unlimited viewport)
  const tilesOnScreenX = Math.ceil(CANVAS.width / TILE_SIZE) + 2; // +2 for buffer
  const tilesOnScreenY = Math.ceil(CANVAS.height / TILE_SIZE) + 2;

  // Use viewport size for fogged view, screen size for unfogged (controller)
  const renderWidth = fogged ? vWidth : tilesOnScreenX;
  const renderHeight = fogged ? vHeight : tilesOnScreenY;

  const halfWidth = Math.floor(renderWidth / 2);
  const halfHeight = Math.floor(renderHeight / 2);
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
  for (let vy = 0; vy < renderHeight; vy++) {
    for (let vx = 0; vx < renderWidth; vx++) {
      const mx = Math.floor(viewportX) + vx - halfWidth;
      const my = Math.floor(viewportY) + vy - halfHeight;
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
      // Check if this is the exit tile
      if (maze.exit && mx === maze.exit.x && my === maze.exit.y) {
        color = "#00ff88"; // Bright cyan-green for the exit
      } else if (tile === "#") {
        // Draw brick texture for walls
        drawBrickTile(px, py, TILE_SIZE, mx, my, maze, visible);
        continue;
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
    for (let vy = 0; vy < renderHeight; vy++) {
      for (let vx = 0; vx < renderWidth; vx++) {
        const mx = Math.floor(viewportX) + vx - halfWidth;
        const my = Math.floor(viewportY) + vy - halfHeight;
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
    for (let vy = 0; vy < renderHeight; vy++) {
      for (let vx = 0; vx < renderWidth; vx++) {
        const mx = Math.floor(viewportX) + vx - halfWidth;
        const my = Math.floor(viewportY) + vy - halfHeight;
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
