import { setupInput } from "./game/engine/input";
import { renderViewport, resizeCanvas } from "./game/engine/render";
import { CANVAS, VIEWPORT_SIZE, CONTROLLER_VIEWPORT_SIZE, CAMERA_SPEED, PLAYER_COLORS } from "./game/constants";
import { Maze, Player, Role } from "./game/types";
import { NetworkManager } from "./game/network/manager";
import { generateMnemonicId } from "../shared/id-generator";
import type { LobbyPlayer } from "../shared/protocol";

let maze: Maze | null = null;
let me: Player | null = null;
let subjects: Player[] = [];
let remotePlayers: Map<string, Player> = new Map();
let role: Role = null;
let viewportX = 0;
let viewportY = 0;
let controllerViewport: Player = { x: 0, y: 0, renderX: 0, renderY: 0 };
let networkManager: NetworkManager | null = null;
let isReady = false;
let inLobby = true;

const roleRef: { current: Role } = { current: role };
const meRef: { current: Player | null } = { current: me };
const mazeRef: { current: Maze | null } = { current: null };

function getOrCreateSessionId(): string {
  const params = new URLSearchParams(window.location.search);
  let sessionId = params.get('s');

  if (!sessionId) {
    sessionId = generateMnemonicId();
    params.set('s', sessionId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  return sessionId;
}

function updateLobbyUI(players: LobbyPlayer[], myPlayerId: string | null) {
  const playersList = document.getElementById("playersList")!;
  const playerCount = document.getElementById("playerCount")!;

  playerCount.textContent = players.length.toString();

  playersList.innerHTML = players.map(p => {
    const roleClass = p.role === "controller" ? "role-controller" : "role-subject";
    const roleName = p.role === "controller" ? "Controller" : "Subject";
    const readyClass = p.isReady ? "player-ready" : "player-not-ready";
    const readyText = p.isReady ? "✓ Ready" : "Not Ready";
    const isMe = p.id === myPlayerId ? " (You)" : "";
    const displayName = p.name || `Player ${p.id.substring(0, 8)}`;

    return `
      <div class="player-item">
        <div>
          ${displayName}${isMe}
          <span class="player-role ${roleClass}">${roleName}</span>
        </div>
        <div class="${readyClass}">${readyText}</div>
      </div>
    `;
  }).join('');
}

function showLobby() {
  document.getElementById("lobby")!.classList.add("show");
  document.getElementById("game-container")!.classList.remove("show");
}

function showGame() {
  document.getElementById("lobby")!.classList.remove("show");
  document.getElementById("game-container")!.classList.add("show");
}

async function init() {
  const sessionId = getOrCreateSessionId();
  console.log(`Session ID: ${sessionId}`);

  // Display session link
  const sessionUrl = window.location.href;
  const sessionLinkEl = document.getElementById("sessionLink")!;
  sessionLinkEl.textContent = sessionUrl;

  // Copy link on click
  sessionLinkEl.onclick = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      sessionLinkEl.classList.add("copied");
      const originalText = sessionLinkEl.textContent;
      sessionLinkEl.textContent = "Copied!";
      setTimeout(() => {
        sessionLinkEl.textContent = originalText;
        sessionLinkEl.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Ready button
  const readyBtn = document.getElementById("readyBtn")! as HTMLButtonElement;
  readyBtn.onclick = () => {
    isReady = !isReady;
    readyBtn.textContent = isReady ? "Not Ready" : "Ready";
    readyBtn.classList.toggle("is-ready", isReady);
    networkManager?.setReady(isReady);
  };

  // Player name input
  const playerNameInput = document.getElementById("playerName")! as HTMLInputElement;

  // Load saved name from localStorage
  const savedName = localStorage.getItem("playerName");
  if (savedName) {
    playerNameInput.value = savedName;
  }

  let nameTimeout: number | null = null;
  playerNameInput.oninput = () => {
    if (nameTimeout) {
      clearTimeout(nameTimeout);
    }
    nameTimeout = window.setTimeout(() => {
      const name = playerNameInput.value.trim();
      // Save to localStorage
      if (name) {
        localStorage.setItem("playerName", name);
      } else {
        localStorage.removeItem("playerName");
      }
      networkManager?.setName(name);
    }, 500);
  };

  // Color picker
  let currentColorIndex = 0;
  const savedColor = localStorage.getItem("playerColor");
  if (savedColor) {
    const colorIndex = PLAYER_COLORS.findIndex(c => c.value === savedColor);
    if (colorIndex !== -1) {
      currentColorIndex = colorIndex;
    }
  }

  const colorPreviewTile = document.getElementById("colorPreviewTile")!;
  const colorPrevBtn = document.getElementById("colorPrev")!;
  const colorNextBtn = document.getElementById("colorNext")!;

  function updateColorPreview() {
    const color = PLAYER_COLORS[currentColorIndex];
    colorPreviewTile.style.backgroundColor = color.value;
    localStorage.setItem("playerColor", color.value);
    networkManager?.setColor(color.value);
  }

  colorPrevBtn.onclick = () => {
    currentColorIndex = (currentColorIndex - 1 + PLAYER_COLORS.length) % PLAYER_COLORS.length;
    updateColorPreview();
  };

  colorNextBtn.onclick = () => {
    currentColorIndex = (currentColorIndex + 1) % PLAYER_COLORS.length;
    updateColorPreview();
  };

  // Initialize color preview
  updateColorPreview();

  networkManager = new NetworkManager();

  try {
    await networkManager.connect("ws://localhost:3001/ws", sessionId);
    console.log("Connected to multiplayer server");

    // Join lobby immediately
    networkManager.joinLobby();
    showLobby();

    networkManager.onLobbyJoined((playerId, assignedRole, players) => {
      console.log(`Joined lobby as ${assignedRole}`);
      role = assignedRole;
      roleRef.current = assignedRole;
      updateLobbyUI(players, playerId);

      // Send saved name to server if available
      if (savedName) {
        networkManager?.setName(savedName);
      }
    });

    networkManager.onLobbyUpdated((players) => {
      updateLobbyUI(players, networkManager?.getPlayerId() || null);
    });

    networkManager.onGameStarting((assignedRole) => {
      console.log("Game is starting...");
      document.getElementById("waitingMessage")!.textContent = "Game starting...";
    });

    networkManager.onGameStarted((playerId, x, y, players, receivedMaze, assignedRole) => {
      console.log(`Game started! Role: ${assignedRole}`);
      inLobby = false;
      maze = receivedMaze;
      mazeRef.current = receivedMaze;
      role = assignedRole;
      roleRef.current = assignedRole;

      if (assignedRole === "controller") {
        controllerViewport.x = Math.floor(maze.width / 2);
        controllerViewport.y = Math.floor(maze.height / 2);
        controllerViewport.renderX = controllerViewport.x;
        controllerViewport.renderY = controllerViewport.y;

        players.forEach((player) => {
          remotePlayers.set(player.id!, player);
          subjects.push(player);
        });
        console.log(`Controller watching ${players.length} players`);
      } else {
        const savedColor = localStorage.getItem("playerColor");
        me = { id: playerId, x, y, renderX: x, renderY: y, color: savedColor || undefined };
        meRef.current = me;
        subjects.push(me);

        players.forEach((player) => {
          remotePlayers.set(player.id!, player);
          subjects.push(player);
        });
        console.log("Started as subject");
      }

      showGame();
      setupInput(roleRef, meRef, controllerViewport, mazeRef, networkManager);
      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();
    });

    networkManager.onSpawnFull(() => {
      alert("No spawn points available! Server is full.");
    });

    networkManager.onPlayerJoined((player) => {
      console.log(`Player ${player.id} joined at (${player.x}, ${player.y})`);
      remotePlayers.set(player.id!, player);
      const existingIndex = subjects.findIndex(s => s.id === player.id);
      if (existingIndex >= 0) {
        subjects[existingIndex] = player;
      } else {
        subjects.push(player);
      }
    });

    networkManager.onPlayerMoved((playerId, x, y) => {
      const player = remotePlayers.get(playerId);
      if (player) {
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

        const subjectIndex = subjects.findIndex(s => s.id === playerId);
        if (subjectIndex >= 0 && subjects[subjectIndex] !== player) {
          subjects[subjectIndex] = player;
        }
      } else if (me && me.id === playerId) {
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
      subjects = subjects.filter((s) => s.id !== playerId);
      remotePlayers.delete(playerId);
    });
  } catch (error) {
    console.error("Failed to connect to server:", error);
    alert("Failed to connect to multiplayer server.");
  }

  requestAnimationFrame(loop);
}

function loop() {
  if (inLobby) {
    requestAnimationFrame(loop);
    return;
  }

  if (!role || !maze) {
    requestAnimationFrame(loop);
    return;
  }

  if (role === "controller") {
    viewportX += (controllerViewport.renderX - viewportX) * CAMERA_SPEED;
    viewportY += (controllerViewport.renderY - viewportY) * CAMERA_SPEED;
    renderViewport(maze, viewportX, viewportY, controllerViewport, subjects, false, CONTROLLER_VIEWPORT_SIZE);
  }

  if (role === "subject" && me) {
    viewportX += (me.renderX - viewportX) * CAMERA_SPEED;
    viewportY += (me.renderY - viewportY) * CAMERA_SPEED;
    renderViewport(maze, viewportX, viewportY, me, subjects, true, VIEWPORT_SIZE);
  }

  requestAnimationFrame(loop);
}

init();
