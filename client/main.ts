import { loadMaze } from "./game/entities/maze";
import { spawnSubject } from "./game/entities/player";
import { setupInput } from "./game/engine/input";
import { renderViewport, resizeCanvas } from "./game/engine/render";
import { CANVAS, VIEWPORT_SIZE, CAMERA_SPEED } from "./game/constants";
import { Maze, Player, Role } from "./game/types";
import { NetworkManager } from "./game/network/manager";

let maze: Maze;
let me: Player | null = null;
let subjects: Player[] = [];
let remotePlayers: Map<string, Player> = new Map();
let role: Role = null;
let viewportX = 0;
let viewportY = 0;
let controllerViewport: Player = { x: 0, y: 0, renderX: 0, renderY: 0 };
let networkManager: NetworkManager | null = null;

// Use refs so input always sees latest values
const roleRef: { current: Role } = { current: role };
const meRef: { current: Player | null } = { current: me };

async function init() {
  maze = await loadMaze("./maze.json");

  // Initialize network manager
  networkManager = new NetworkManager();

  try {
    await networkManager.connect("ws://localhost:3001/ws");
    console.log("Connected to multiplayer server");

    // Setup network event handlers
    networkManager.onJoined((playerId, x, y, players) => {
      console.log(`Joined as ${playerId} at (${x}, ${y})`);
      me = { id: playerId, x, y, renderX: x, renderY: y };
      meRef.current = me;
      subjects.push(me);

      // Add existing players
      players.forEach((player) => {
        remotePlayers.set(player.id!, player);
        subjects.push(player);
      });
    });

    networkManager.onSpawnFull(() => {
      alert("No spawn points available! Server is full.");
    });

    networkManager.onPlayerJoined((player) => {
      console.log(`Player ${player.id} joined at (${player.x}, ${player.y})`);
      remotePlayers.set(player.id!, player);
      subjects.push(player);
    });

    networkManager.onPlayerMoved((playerId, x, y) => {
      // Find and update the player
      const player = remotePlayers.get(playerId);
      if (player) {
        // Smooth movement animation
        const startX = player.renderX;
        const startY = player.renderY;
        player.x = x;
        player.y = y;

        const startTime = performance.now();
        const MOVE_DURATION = 150;

        function animate(time: number) {
          const t = Math.min((time - startTime) / MOVE_DURATION, 1);
          player!.renderX = startX + (x - startX) * t;
          player!.renderY = startY + (y - startY) * t;
          if (t < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
      } else if (me && me.id === playerId) {
        // Update own position (server confirmation)
        const startX = me.renderX;
        const startY = me.renderY;
        me.x = x;
        me.y = y;

        const startTime = performance.now();
        const MOVE_DURATION = 150;

        function animate(time: number) {
          const t = Math.min((time - startTime) / MOVE_DURATION, 1);
          me!.renderX = startX + (x - startX) * t;
          me!.renderY = startY + (y - startY) * t;
          if (t < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
      }
    });

    networkManager.onPlayerLeft((playerId) => {
      console.log(`Player ${playerId} left`);
      const player = remotePlayers.get(playerId);
      if (player) {
        subjects = subjects.filter((s) => s.id !== playerId);
        remotePlayers.delete(playerId);
      }
    });
  } catch (error) {
    console.error("Failed to connect to server:", error);
    alert("Failed to connect to multiplayer server. Running in offline mode.");
    networkManager = null;
  }

  document.getElementById("controllerBtn")!.onclick = () => {
    role = "controller";
    roleRef.current = role;
    controllerViewport.x = Math.floor(maze.width / 2);
    controllerViewport.y = Math.floor(maze.height / 2);
    controllerViewport.renderX = controllerViewport.x;
    controllerViewport.renderY = controllerViewport.y;
  };

  document.getElementById("subjectBtn")!.onclick = () => {
    role = "subject";
    roleRef.current = role;

    if (networkManager) {
      // Join multiplayer
      networkManager.joinAsSubject();
    } else {
      // Fallback to local mode
      me = spawnSubject(maze, subjects);
      meRef.current = me;
    }
  };

  setupInput(roleRef, meRef, controllerViewport, maze, networkManager);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  requestAnimationFrame(loop);
}

function loop() {
  if (!role) {
    const CTX = CANVAS.getContext("2d")!;
    CTX.fillStyle = "#222";
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
    CTX.fillStyle = "white";
    CTX.fillText("Choose a role to begin", 180, 280);
    requestAnimationFrame(loop);
    return;
  }

  if (role === "controller") {
    viewportX += (controllerViewport.renderX - viewportX) * CAMERA_SPEED;
    viewportY += (controllerViewport.renderY - viewportY) * CAMERA_SPEED;
    renderViewport(maze, viewportX, viewportY, controllerViewport, subjects, false);
  }

  if (role === "subject" && me) {
    viewportX += (me.renderX - viewportX) * CAMERA_SPEED;
    viewportY += (me.renderY - viewportY) * CAMERA_SPEED;
    renderViewport(maze, viewportX, viewportY, me, subjects, true);
  }

  requestAnimationFrame(loop);
}

init();
