import { loadMaze } from "./maze";
import { spawnSubject } from "./player";
import { setupInput } from "./input";
import { renderViewport, resizeCanvas } from "./render";
import { CANVAS, VIEWPORT_SIZE, CAMERA_SPEED } from "./constants";
import { Maze, Player, Role } from "./types";

let maze: Maze;
let me: Player | null = null;
let subjects: Player[] = [];
let role: Role = null;
let viewportX = 0;
let viewportY = 0;
let controllerViewport: Player = { x: 0, y: 0, renderX: 0, renderY: 0 };

async function init() {
  maze = await loadMaze("./maze.json");

  document.getElementById("controllerBtn")!.onclick = () => {
    role = "controller";
    controllerViewport.x = Math.floor(maze.width / 2);
    controllerViewport.y = Math.floor(maze.height / 2);
    controllerViewport.renderX = controllerViewport.x;
    controllerViewport.renderY = controllerViewport.y;
  };

  document.getElementById("subjectBtn")!.onclick = () => {
    role = "subject";
    me = spawnSubject(maze, subjects);
  };

  setupInput({ current: role }, me, controllerViewport, maze);
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