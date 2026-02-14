import { spawnSubject } from "./game/entities/player";
import { setupInput } from "./game/engine/input";
import { renderViewport, resizeCanvas } from "./game/engine/render";
import { CANVAS, VIEWPORT_SIZE, CAMERA_SPEED } from "./game/constants";
import { Maze, Player, Role } from "./game/types";
import { NetworkManager } from "./game/network/manager";
import { generateMnemonicId } from "../shared/id-generator";

let maze: Maze | null = null;
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
const mazeRef: { current: Maze | null } = { current: null };

function getOrCreateSessionId(): string {
  // Try to get session ID from URL query parameters
  const params = new URLSearchParams(window.location.search);
  let sessionId = params.get('s');

  if (!sessionId) {
    // Generate human-readable mnemonic ID
    sessionId = generateMnemonicId();

    // Update URL with new session ID
    params.set('s', sessionId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  return sessionId;
}

async function init() {
  // Get or create session ID from URL
  const sessionId = getOrCreateSessionId();
  console.log(`Session ID: ${sessionId}`);

  // Initialize network manager
  networkManager = new NetworkManager();

  try {
    await networkManager.connect("ws://localhost:3001/ws", sessionId);
    console.log("Connected to multiplayer server");

    // Setup network event handlers
    networkManager.onJoined((playerId, x, y, players, receivedMaze) => {
      console.log(`Joined as ${playerId} at (${x}, ${y})`);
      console.log("Received maze data:", receivedMaze);
      console.log("Maze dimensions:", receivedMaze?.width, "x", receivedMaze?.height);
      console.log("Maze tiles count:", receivedMaze?.tiles?.length);

      // Receive maze from server
      maze = receivedMaze;
      mazeRef.current = receivedMaze;
      console.log(`Received maze: ${receivedMaze.width}x${receivedMaze.height}`);

      // Determine role based on whether we have a valid spawn position
      if (x === 0 && y === 0 && players.length === 0) {
        // Controller joined (no spawn position)
        role = "controller";
        roleRef.current = role;
        controllerViewport.x = Math.floor(maze.width / 2);
        controllerViewport.y = Math.floor(maze.height / 2);
        controllerViewport.renderX = controllerViewport.x;
        controllerViewport.renderY = controllerViewport.y;
        console.log("Joined as controller");
      } else {
        // Subject joined (has spawn position)
        role = "subject";
        roleRef.current = role;

        me = { id: playerId, x, y, renderX: x, renderY: y };
        meRef.current = me;
        subjects.push(me);

        // Add existing players
        players.forEach((player) => {
          remotePlayers.set(player.id!, player);
          subjects.push(player);
        });
        console.log("Joined as subject");
      }
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
    if (networkManager) {
      // Join multiplayer as controller - maze will be received after joining
      console.log("Joining as controller...");
      networkManager.joinAsController();
      // Role will be set when maze data is received in onJoined callback
    } else {
      // Fallback to local mode
      if (!maze) {
        alert("No maze available in offline mode");
        return;
      }
      role = "controller";
      roleRef.current = role;
      controllerViewport.x = Math.floor(maze.width / 2);
      controllerViewport.y = Math.floor(maze.height / 2);
      controllerViewport.renderX = controllerViewport.x;
      controllerViewport.renderY = controllerViewport.y;
    }
  };

  document.getElementById("subjectBtn")!.onclick = () => {
    if (networkManager) {
      // Join multiplayer - maze will be received after joining
      console.log("Joining as subject...");
      networkManager.joinAsSubject();
    } else {
      // Fallback to local mode
      if (!maze) {
        alert("No maze available in offline mode");
        return;
      }
      role = "subject";
      roleRef.current = role;
      me = spawnSubject(maze, subjects);
      meRef.current = me;
    }
  };

  // Share link button handler
  const shareLinkDiv = document.getElementById("shareLink")!;
  const linkText = document.getElementById("linkText")!;
  const shareLinkBtn = document.getElementById("shareLinkBtn")!;
  const copyBtn = document.getElementById("copyBtn")!;

  shareLinkBtn.onclick = () => {
    const currentUrl = window.location.href;
    linkText.textContent = currentUrl;
    shareLinkDiv.classList.toggle("show");
  };

  copyBtn.onclick = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  setupInput(roleRef, meRef, controllerViewport, mazeRef, networkManager);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  requestAnimationFrame(loop);
}

function loop() {
  if (!role || !maze) {
    const CTX = CANVAS.getContext("2d")!;
    CTX.fillStyle = "#222";
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
    CTX.fillStyle = "white";
    const message = !role ? "Choose a role to begin" : "Waiting for maze data...";
    CTX.fillText(message, 180, 280);
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
