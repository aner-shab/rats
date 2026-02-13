import { movePlayer } from "./player";
import { Player, Role, Maze } from "./types";

export function setupInput(
  roleRef: { current: Role },
  me: Player | null,
  controllerViewport: Player,
  maze: Maze
) {
  window.addEventListener("keydown", (e) => {
    if (!roleRef.current) return;

    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!dx && !dy) return;

    if (roleRef.current === "subject" && me) {
      movePlayer(maze, me, dx, dy);
    }
    if (roleRef.current === "controller") {
      movePlayer(maze, controllerViewport, dx, dy);
    }
  });
}