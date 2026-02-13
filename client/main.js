// const VIEWPORT_SIZE = 11; // 11x11 tiles
// const CANVAS = document.getElementById("game");
// const CTX = CANVAS.getContext("2d");
// const DEBUG = false;
// let role = null;
// let maze = null;
// let subjects = [];
// let me = null;
// let viewportX = 0;
// let viewportY = 0;
// const CAMERA_SPEED = 0.1; // lerp factor (0-1), lower = slower

// let controllerViewport = { x: 0, y: 0, renderX: 0, renderY: 0 };
// const MOVE_DURATION = 150; // ms for smooth tile movement

// // ---------- LOAD MAZE ----------
// fetch("./maze.json")
//   .then(res => res.json())
//   .then(data => {
//     maze = data;
//     init();
//   });

// function init() {
//   document.getElementById("controllerBtn").onclick = () => {
//     role = "controller";
//     controllerViewport.x = Math.floor(maze.width / 2);
//     controllerViewport.y = Math.floor(maze.height / 2);
//     controllerViewport.renderX = controllerViewport.x;
//     controllerViewport.renderY = controllerViewport.y;
//   };

//   document.getElementById("subjectBtn").onclick = () => {
//     role = "subject";
//     spawnSubject();
//   };

//   requestAnimationFrame(loop);
// }

// function resizeCanvas() {
//   CANVAS.width = window.innerWidth;
//   CANVAS.height = window.innerHeight;
// }

// window.addEventListener("resize", resizeCanvas);
// resizeCanvas();

// function getTileSize() {
//   return Math.floor(
//     Math.min(CANVAS.width, CANVAS.height) / VIEWPORT_SIZE
//   );
// }

// // ---------- SUBJECT SPAWN ----------
// function spawnSubject() {
//   const used = subjects.map(s => `${s.x},${s.y}`);

//   for (let y = 0; y < maze.height; y++) {
//     for (let x = 0; x < maze.width; x++) {
//       if (maze.tiles[y][x] === "S") {
//         const key = `${x},${y}`;
//         if (!used.includes(key)) {
//           me = { x, y, renderX: x, renderY: y };
//           subjects.push(me);
//           return;
//         }
//       }
//     }
//   }
// }

// // ---------- INPUT ----------
// window.addEventListener("keydown", e => {
//   if (role === "subject") handleSubjectInput(e);
//   if (role === "controller") handleControllerInput(e);
// });

// function handleSubjectInput(e) {
//   const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
//   const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
//   if (!dx && !dy) return;

//   movePlayer(me, dx, dy);
// }

// function handleControllerInput(e) {
//   const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
//   const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
//   if (!dx && !dy) return;

//   movePlayer(controllerViewport, dx, dy);
// }

// // ---------- MOVEMENT ANIMATION ----------
// function movePlayer(player, dx, dy) {
//   const targetX = player.x + dx;
//   const targetY = player.y + dy;

//   if (maze.tiles[targetY]?.[targetX] && maze.tiles[targetY][targetX] !== "#") {
//     player.x = targetX;
//     player.y = targetY;

//     const startX = player.renderX;
//     const startY = player.renderY;
//     const startTime = performance.now();

//     function animate(time) {
//       const t = Math.min((time - startTime) / MOVE_DURATION, 1);
//       player.renderX = startX + (player.x - startX) * t;
//       player.renderY = startY + (player.y - startY) * t;
//       if (t < 1) requestAnimationFrame(animate);
//     }

//     requestAnimationFrame(animate);
//   }
// }

// // ---------- VISIBILITY ----------
// function getVisibleTiles(startX, startY, maxDepth = 2) {
//   const visible = new Set();
//   const queue = [{ x: startX, y: startY, d: 0 }];

//   while (queue.length > 0) {
//     const { x, y, d } = queue.shift();
//     const key = `${x},${y}`;
//     if (visible.has(key)) continue;
//     visible.add(key);
//     if (d === maxDepth) continue;

//     const neighbors = [
//       { x: x + 1, y },
//       { x: x - 1, y },
//       { x, y: y + 1 },
//       { x, y: y - 1 }
//     ];

//     for (const n of neighbors) {
//       if (maze.tiles[n.y]?.[n.x] && maze.tiles[n.y][n.x] !== "#") {
//         queue.push({ x: n.x, y: n.y, d: d + 1 });
//       }
//     }
//   }

//   return visible;
// }

// // ---------- MAIN LOOP ----------
// function loop() {
//   CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

//   if (!role) {
//     CTX.fillStyle = "#222";
//     CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
//     CTX.fillStyle = "white";
//     CTX.fillText("Choose a role to begin", 180, 280);
//     requestAnimationFrame(loop);
//     return;
//   }

//   if (role === "controller") {
//     // Smoothly follow the controller's renderX/Y
//     viewportX += (controllerViewport.renderX - viewportX) * CAMERA_SPEED;
//     viewportY += (controllerViewport.renderY - viewportY) * CAMERA_SPEED;

//     renderViewport(viewportX, viewportY, false);
//   }

//   if (role === "subject") {
//     // Smoothly follow the subject
//     viewportX += (me.renderX - viewportX) * CAMERA_SPEED;
//     viewportY += (me.renderY - viewportY) * CAMERA_SPEED;

//     renderViewport(viewportX, viewportY, !DEBUG);
//   }

//   requestAnimationFrame(loop);
// }

// // ---------- RENDERING ----------
// function renderViewport(cx, cy, fogged) {
//   CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

//   const TILE_SIZE = getTileSize();
//   const half = Math.floor(VIEWPORT_SIZE / 2);

//   const visible = fogged ? getVisibleTiles(me.x, me.y, 2) : null;
//   const viewportTiles = new Set();
//     for (let vy = 0; vy < VIEWPORT_SIZE; vy++) {
//       for (let vx = 0; vx < VIEWPORT_SIZE; vx++) {
//         const mx = cx + vx - half;
//         const my = cy + vy - half;
//         viewportTiles.add(`${mx},${my}`);
//       }
//     }

//   function isWallAdjacentToVisible(mx, my, visibleSet) {
//     if (!visibleSet) return false;
//     const neighbors = [
//       { x: mx + 1, y: my },
//       { x: mx - 1, y: my },
//       { x: mx, y: my + 1 },
//       { x: mx, y: my - 1 }
//     ];

//     return neighbors.some(n => visibleSet.has(`${n.x},${n.y}`));
//   }

// for (let vy = 0; vy < VIEWPORT_SIZE; vy++) {
//   for (let vx = 0; vx < VIEWPORT_SIZE; vx++) {
//     const mx = Math.floor(cx) + vx - half;
//     const my = Math.floor(cy) + vy - half;

//     const tileX = Math.floor(viewportX) + vx - Math.floor(VIEWPORT_SIZE / 2);
//     const tileY = Math.floor(viewportY) + vy - Math.floor(VIEWPORT_SIZE / 2);

//     const px = CANVAS.width/2 + (tileX - viewportX) * TILE_SIZE;
//     const py = CANVAS.height/2 + (tileY - viewportY) * TILE_SIZE;
//     const tile = maze.tiles[my]?.[mx];
//     if (!tile) {
//       // Outside maze = black
//       drawTile(px, py, "#111");
//       continue;
//     }

//     // Tile color logic
//     let color;
//       if (tile === "#") {
//         color = (fogged && isWallAdjacentToVisible(mx, my, visible)) ? "#504630" : "#111";
//       } else {
//         if (!visible.has(`${mx},${my}`)){
//           drawTile(px,py,'#111');
//           continue;
//         }
//         color = "#aaa"; // floor
//       }
//     drawTile(px, py, color);
//   }
// }

//     // Draw subjects
//     // subjects.forEach(s => {
//     //   const relX = s.renderX - cx;
//     //   const relY = s.renderY - cy;
//     //   const renderPx = offsetX + (half + relX) * TILE_SIZE;
//     //   const renderPy = offsetY + (half + relY) * TILE_SIZE;
//     //   CTX.fillStyle = "red";
//     //   CTX.fillRect(renderPx + 10, renderPy + 10, 30, 30);
//     // });

//     // Draw main player
//     const playerPx = CANVAS.width / 2 + (me.renderX - viewportX) * TILE_SIZE;
//     const playerPy = CANVAS.height / 2 + (me.renderY - viewportY) * TILE_SIZE;
//     CTX.fillStyle = "blue";
//     CTX.fillRect(playerPx, playerPy, TILE_SIZE / 2, TILE_SIZE /2);
//     // CTX.fillRect(Math.floor(playerPx), Math.floor(playerPy), Math.ceil(TILE_SIZE /2), Math.ceil(TILE_SIZE /2));
// }

// // ---------- DRAW TILE HELPER ----------
// function drawTile(x, y, color) {
//   CTX.fillStyle = color;
//   const TILE_SIZE = getTileSize();
//   // CTX.fillRect(x, y, TILE_SIZE, TILE_SIZE);
//   CTX.fillRect(Math.floor(x), Math.floor(y), Math.ceil(TILE_SIZE), Math.ceil(TILE_SIZE));
// }
