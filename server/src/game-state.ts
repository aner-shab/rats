import type { WebSocket } from "ws";
import type { Player, Maze } from "../../shared/protocol";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load all available mazes once at startup
const mazesPath = join(__dirname, "../mazes.json");
const mazesData = JSON.parse(readFileSync(mazesPath, "utf-8"));
const availableMazes: Maze[] = mazesData.mazes;

export class GameState {
    private players: Map<string, Player & { socket: WebSocket }> = new Map();
    private controllers: Set<WebSocket> = new Set();
    private usedSpawnPoints: Set<string> = new Set();
    private maze: Maze;
    private disconnectedPlayers: Map<string, Player> = new Map();

    constructor() {
        // const randomIndex = Math.floor(Math.random() * availableMazes.length);
        const randomIndex = 0;
        this.maze = availableMazes[randomIndex];
        console.log(`Selected maze: ${this.maze.name}`);
    }

    getMaze(): Maze {
        return this.maze;
    }

    findAvailableSpawnPoint(): { x: number; y: number } | null {
        for (let y = 0; y < this.maze.height; y++) {
            for (let x = 0; x < this.maze.width; x++) {
                if (this.maze.tiles[y][x] === "S") {
                    const key = `${x},${y}`;
                    if (!this.usedSpawnPoints.has(key)) {
                        this.usedSpawnPoints.add(key);
                        return { x, y };
                    }
                }
            }
        }
        return null;
    }

    addController(controllerId: string, socket: WebSocket): void {
        this.controllers.add(socket);
    }

    removeController(socket: WebSocket): void {
        this.controllers.delete(socket);
    }

    addPlayer(playerId: string, socket: WebSocket): Player | null {
        // Check if player is already connected (shouldn't happen, but handle it)
        const existingPlayer = this.players.get(playerId);
        if (existingPlayer) {
            console.warn(`Player ${playerId} is already connected, updating socket`);
            existingPlayer.socket = socket;
            return existingPlayer;
        }

        // Check if player was previously disconnected and restore their position
        const disconnectedPlayer = this.disconnectedPlayers.get(playerId);
        if (disconnectedPlayer) {
            console.log(`Restoring player ${playerId} at (${disconnectedPlayer.x}, ${disconnectedPlayer.y})`);
            const player: Player & { socket: WebSocket } = {
                ...disconnectedPlayer,
                socket,
            };
            this.players.set(playerId, player);
            this.disconnectedPlayers.delete(playerId);
            return player;
        }

        // New player - find a spawn point
        const spawn = this.findAvailableSpawnPoint();
        if (!spawn) return null;

        const player: Player & { socket: WebSocket } = {
            id: playerId,
            x: spawn.x,
            y: spawn.y,
            renderX: spawn.x,
            renderY: spawn.y,
            socket,
        };

        this.players.set(playerId, player);
        return player;
    }

    removePlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            // Save player state for potential reconnection
            const { socket, ...playerState } = player;
            this.disconnectedPlayers.set(playerId, playerState);
            console.log(`Saved state for disconnected player ${playerId} at (${playerState.x}, ${playerState.y})`);

            this.players.delete(playerId);
        }
    }

    movePlayer(playerId: string, dx: number, dy: number): boolean {
        const player = this.players.get(playerId);
        if (!player) return false;

        const targetX = player.x + dx;
        const targetY = player.y + dy;

        // Validate move
        if (
            targetX < 0 ||
            targetY < 0 ||
            targetY >= this.maze.height ||
            targetX >= this.maze.width
        ) {
            return false;
        }

        const tile = this.maze.tiles[targetY][targetX];
        if (tile === "#") return false;

        // Move is valid
        player.x = targetX;
        player.y = targetY;
        player.renderX = targetX;
        player.renderY = targetY;

        return true;
    }

    getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId);
    }

    getAllPlayers(): Player[] {
        return Array.from(this.players.values()).map(({ socket, ...player }) => player);
    }

    getOtherPlayers(excludeId: string): Player[] {
        return Array.from(this.players.values())
            .filter((p) => p.id !== excludeId)
            .map(({ socket, ...player }) => player);
    }

    broadcastToAll(message: any): void {
        const payload = JSON.stringify(message);
        // Send to all players
        this.players.forEach((player) => {
            if (player.socket.readyState === 1) {
                // OPEN
                player.socket.send(payload);
            }
        });
        // Send to all controllers
        this.controllers.forEach((socket) => {
            if (socket.readyState === 1) {
                socket.send(payload);
            }
        });
    }

    broadcastToOthers(excludeId: string, message: any): void {
        const payload = JSON.stringify(message);
        // Send to other players
        this.players.forEach((player) => {
            if (player.id !== excludeId && player.socket.readyState === 1) {
                player.socket.send(payload);
            }
        });
        // Send to all controllers
        this.controllers.forEach((socket) => {
            if (socket.readyState === 1) {
                socket.send(payload);
            }
        });
    }
}
