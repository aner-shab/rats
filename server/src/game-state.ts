import type { WebSocket } from "ws";
import type { Player, Maze } from "../../shared/protocol.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GameState {
    private players: Map<string, Player & { socket: WebSocket }> = new Map();
    private usedSpawnPoints: Set<string> = new Set();
    private maze: Maze;

    constructor() {
        // Load maze from client directory
        const mazePath = join(__dirname, "../../client/maze.json");
        const mazeData = JSON.parse(readFileSync(mazePath, "utf-8"));
        this.maze = mazeData;
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

    addPlayer(playerId: string, socket: WebSocket): Player | null {
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
            const spawnKey = `${player.x},${player.y}`;
            // Only free if player is still at spawn
            const hasntMoved = player.x === player.renderX && player.y === player.renderY;
            if (hasntMoved) {
                this.usedSpawnPoints.delete(spawnKey);
            }
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
        this.players.forEach((player) => {
            if (player.socket.readyState === 1) {
                // OPEN
                player.socket.send(payload);
            }
        });
    }

    broadcastToOthers(excludeId: string, message: any): void {
        const payload = JSON.stringify(message);
        this.players.forEach((player) => {
            if (player.id !== excludeId && player.socket.readyState === 1) {
                player.socket.send(payload);
            }
        });
    }
}
