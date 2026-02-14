import { movePlayer } from "../entities/player";
import { Player, Role, Maze } from "../types";
import { NetworkManager } from "../network/manager";

export function setupInput(
  roleRef: { current: Role },
  meRef: { current: Player | null },
  controllerViewport: Player,
  mazeRef: { current: Maze | null },
  networkManager: NetworkManager | null
) {
  window.addEventListener("keydown", (e) => {
    if (!roleRef.current || !mazeRef.current) return;

    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!dx && !dy) return;

    if (roleRef.current === "subject" && meRef.current) {
      // Send move to server instead of local move
      if (networkManager) {
        networkManager.sendMove(dx, dy);
      } else {
        // Fallback to local move if no network
        movePlayer(mazeRef.current, meRef.current, dx, dy);
      }
    }
    if (roleRef.current === "controller") {
      // Controllers can move freely without collision detection
      controllerViewport.x += dx;
      controllerViewport.y += dy;
      controllerViewport.renderX = controllerViewport.x;
      controllerViewport.renderY = controllerViewport.y;
    }
  });
}
