import type { WebSocket } from "ws";
import type { Player, Maze, LobbyPlayer } from "../../shared/protocol";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mazesPath = join(__dirname, "../mazes.json");
const mazesData = JSON.parse(readFileSync(mazesPath, "utf-8"));
const availableMazes: Maze[] = mazesData.mazes;

export class GameState {
    private players: Map<string, Player & { socket: WebSocket; persistentId: string }> = new Map();
    private lobbyPlayers: Map<string, LobbyPlayer & { socket: WebSocket }> = new Map();
    private usedSpawnPoints: Set<string> = new Set();
    private maze: Maze;
    private disconnectedPlayers: Map<string, Player> = new Map();
    private gameStarted: boolean = false;
    private controllerAssigned: boolean = false;
    private controllerPersistentId: string | null = null;
    private controllerPlayerId: string | null = null;

    constructor() {
        const randomIndex = 0;
        this.maze = availableMazes[randomIndex];
        console.log(`Selected maze: ${this.maze.name}`);
    }

    isGameStarted(): boolean {
        return this.gameStarted;
    }

    getMaze(): Maze {
        return this.maze;
    }

    // Lobby management
    addLobbyPlayer(playerId: string, persistentId: string, socket: WebSocket): { role: "controller" | "subject"; players: LobbyPlayer[] } | null {
        // Check if this persistent ID has a disconnected game state
        if (this.gameStarted && this.disconnectedPlayers.has(persistentId)) {
            console.log(`Player ${persistentId} attempting to rejoin active game`);
            return null; // Signal to handle reconnection differently
        }

        // Check if this persistent ID was the controller
        if (this.gameStarted && persistentId === this.controllerPersistentId) {
            console.log(`Controller ${persistentId} attempting to rejoin active game`);
            return null; // Signal to handle reconnection differently
        }

        // First player becomes controller (max 1 controller)
        const role: "controller" | "subject" = !this.controllerAssigned ? "controller" : "subject";

        if (role === "controller") {
            this.controllerAssigned = true;
        }

        const lobbyPlayer: LobbyPlayer & { socket: WebSocket } = {
            id: playerId,
            persistentId,
            role,
            isReady: false,
            name: undefined,
            socket,
        };

        this.lobbyPlayers.set(playerId, lobbyPlayer);
        console.log(`Player ${playerId} joined lobby as ${role}`);

        return {
            role,
            players: this.getLobbyPlayers(),
        };
    }

    removeLobbyPlayer(playerId: string): void {
        const player = this.lobbyPlayers.get(playerId);
        if (player) {
            if (player.role === "controller") {
                this.controllerAssigned = false;
            }
            this.lobbyPlayers.delete(playerId);
        }
    }

    // Reconnect a player to an active game
    reconnectPlayer(playerId: string, persistentId: string, socket: WebSocket): { player: Player; maze: Maze; role: "controller" | "subject" } | null {
        // Check if rejoining as controller
        if (persistentId === this.controllerPersistentId) {
            console.log(`Controller ${playerId} reconnecting`);

            this.controllerPlayerId = playerId;

            const controller: Player & { socket: WebSocket; persistentId: string } = {
                id: playerId,
                x: 0,
                y: 0,
                renderX: 0,
                renderY: 0,
                socket,
                persistentId,
            };

            this.players.set(playerId, controller);

            return {
                player: controller,
                maze: this.maze,
                role: "controller",
            };
        }

        // Check if rejoining as subject
        const disconnectedState = this.disconnectedPlayers.get(persistentId);
        if (!disconnectedState) {
            return null;
        }

        // Restore player with new socket and ID
        const player: Player & { socket: WebSocket; persistentId: string } = {
            ...disconnectedState,
            id: playerId,
            socket,
            persistentId,
        };

        this.players.set(playerId, player);
        this.disconnectedPlayers.delete(persistentId);

        console.log(`Player ${playerId} reconnected at (${player.x}, ${player.y})`);

        return {
            player,
            maze: this.maze,
            role: "subject",
        };
    }

    setPlayerReady(playerId: string, isReady: boolean): LobbyPlayer[] {
        const player = this.lobbyPlayers.get(playerId);
        if (player) {
            player.isReady = isReady;
        }
        return this.getLobbyPlayers();
    }

    setPlayerName(playerId: string, name: string): LobbyPlayer[] {
        const player = this.lobbyPlayers.get(playerId);
        if (player) {
            player.name = name;
        }
        return this.getLobbyPlayers();
    }

    setPlayerColor(playerId: string, color: string): LobbyPlayer[] {
        const player = this.lobbyPlayers.get(playerId);
        if (player) {
            player.color = color;
        }
        return this.getLobbyPlayers();
    }

    getLobbyPlayers(): LobbyPlayer[] {
        return Array.from(this.lobbyPlayers.values()).map(({ socket, ...player }) => player);
    }

    areAllPlayersReady(): boolean {
        const players = Array.from(this.lobbyPlayers.values());
        return players.length > 0 && players.every(p => p.isReady);
    }

    startGame(): Map<string, { role: "controller" | "subject"; x: number; y: number; socket: WebSocket }> {
        this.gameStarted = true;
        const spawnedPlayers = new Map<string, { role: "controller" | "subject"; x: number; y: number; socket: WebSocket }>();

        this.lobbyPlayers.forEach((lobbyPlayer) => {
            if (lobbyPlayer.role === "controller") {
                // Save controller's persistent ID and player ID for reconnection
                this.controllerPersistentId = lobbyPlayer.persistentId;
                this.controllerPlayerId = lobbyPlayer.id;

                // Controllers don't need spawn points but need to be tracked for broadcasts
                const controller: Player & { socket: WebSocket; persistentId: string } = {
                    id: lobbyPlayer.id,
                    x: 0,
                    y: 0,
                    renderX: 0,
                    renderY: 0,
                    color: lobbyPlayer.color,
                    socket: lobbyPlayer.socket,
                    persistentId: lobbyPlayer.persistentId,
                };
                this.players.set(lobbyPlayer.id, controller);
                spawnedPlayers.set(lobbyPlayer.id, {
                    role: "controller",
                    x: 0,
                    y: 0,
                    socket: lobbyPlayer.socket,
                });
            } else {
                // Subjects need spawn points
                const spawn = this.findAvailableSpawnPoint();
                if (spawn) {
                    const player: Player & { socket: WebSocket; persistentId: string } = {
                        id: lobbyPlayer.id,
                        x: spawn.x,
                        y: spawn.y,
                        renderX: spawn.x,
                        renderY: spawn.y,
                        color: lobbyPlayer.color,
                        socket: lobbyPlayer.socket,
                        persistentId: lobbyPlayer.persistentId,
                    };
                    this.players.set(lobbyPlayer.id, player);
                    spawnedPlayers.set(lobbyPlayer.id, {
                        role: "subject",
                        x: spawn.x,
                        y: spawn.y,
                        socket: lobbyPlayer.socket,
                    });
                }
            }
        });

        // Clear lobby
        this.lobbyPlayers.clear();

        return spawnedPlayers;
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

    removePlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            const { socket, persistentId, ...playerState } = player;
            this.disconnectedPlayers.set(persistentId, playerState);
            console.log(`Saved state for disconnected player ${playerId} (persistentId: ${persistentId}) at (${playerState.x}, ${playerState.y})`);
            this.players.delete(playerId);
        }
    }

    removePlayerWithoutSaving(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Removing player ${playerId} without saving state`);
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
        return Array.from(this.players.values())
            .filter((p) => p.id !== this.controllerPlayerId)
            .map(({ socket, persistentId, ...player }) => player);
    }

    getOtherPlayers(excludeId: string): Player[] {
        return Array.from(this.players.values())
            .filter((p) => p.id !== excludeId && p.id !== this.controllerPlayerId)
            .map(({ socket, persistentId, ...player }) => player);
    }

    broadcastToAll(message: any): void {
        const payload = JSON.stringify(message);
        this.players.forEach((player) => {
            if (player.socket.readyState === 1) {
                player.socket.send(payload);
            }
        });
    }

    broadcastToLobby(message: any): void {
        const payload = JSON.stringify(message);
        this.lobbyPlayers.forEach((player) => {
            if (player.socket.readyState === 1) {
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
