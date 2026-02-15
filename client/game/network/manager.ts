import type { ClientMessage, ServerMessage, Player, Maze, LobbyPlayer } from "../../../shared/protocol";
import { getPersistentPlayerId } from "./persistent-id";

export class NetworkManager {
    private ws: WebSocket | null = null;
    private playerId: string | null = null;
    private persistentId: string;
    private onLobbyJoinedCallback: ((playerId: string, role: "controller" | "subject", players: LobbyPlayer[]) => void) | null = null;
    private onLobbyUpdatedCallback: ((players: LobbyPlayer[]) => void) | null = null;
    private onGameStartingCallback: ((role: "controller" | "subject") => void) | null = null;
    private onGameStartedCallback: ((playerId: string, x: number, y: number, players: Player[], maze: Maze, role: "controller" | "subject") => void) | null = null;
    private onSpawnFullCallback: (() => void) | null = null;
    private onPlayerJoinedCallback: ((player: Player) => void) | null = null;
    private onPlayerMovedCallback: ((playerId: string, x: number, y: number) => void) | null = null;
    private onPlayerLeftCallback: ((playerId: string) => void) | null = null;

    constructor() {
        this.persistentId = getPersistentPlayerId();
    }

    connect(url: string, sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${url}/${sessionId}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log(`Connected to server (session: ${sessionId})`);
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log("Disconnected from server");
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: ServerMessage = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error("Error parsing server message:", error);
                }
            };
        });
    }

    private handleServerMessage(message: ServerMessage): void {
        switch (message.type) {
            case "lobby-joined":
                this.playerId = message.playerId;
                if (this.onLobbyJoinedCallback) {
                    this.onLobbyJoinedCallback(message.playerId, message.role, message.players);
                }
                break;

            case "lobby-updated":
                if (this.onLobbyUpdatedCallback) {
                    this.onLobbyUpdatedCallback(message.players);
                }
                break;

            case "game-starting":
                if (this.onGameStartingCallback) {
                    this.onGameStartingCallback(message.role);
                }
                break;

            case "game-started":
                this.playerId = message.playerId;
                if (this.onGameStartedCallback) {
                    this.onGameStartedCallback(message.playerId, message.x, message.y, message.players, message.maze, message.role);
                }
                break;

            case "spawn-full":
                if (this.onSpawnFullCallback) {
                    this.onSpawnFullCallback();
                }
                break;

            case "player-joined":
                if (this.onPlayerJoinedCallback) {
                    this.onPlayerJoinedCallback(message.player);
                }
                break;

            case "player-moved":
                if (this.onPlayerMovedCallback) {
                    this.onPlayerMovedCallback(message.playerId, message.x, message.y);
                }
                break;

            case "player-left":
                if (this.onPlayerLeftCallback) {
                    this.onPlayerLeftCallback(message.playerId);
                }
                break;
        }
    }

    sendMessage(message: ClientMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    joinLobby(): void {
        this.sendMessage({ type: "join-lobby", persistentId: this.persistentId });
    }

    setReady(isReady: boolean): void {
        this.sendMessage({ type: "set-ready", isReady });
    }

    setName(name: string): void {
        this.sendMessage({ type: "set-name", name });
    }

    setColor(color: string): void {
        this.sendMessage({ type: "set-color", color });
    }

    sendMove(dx: number, dy: number): void {
        this.sendMessage({ type: "move", dx, dy });
    }

    onLobbyJoined(callback: (playerId: string, role: "controller" | "subject", players: LobbyPlayer[]) => void): void {
        this.onLobbyJoinedCallback = callback;
    }

    onLobbyUpdated(callback: (players: LobbyPlayer[]) => void): void {
        this.onLobbyUpdatedCallback = callback;
    }

    onGameStarting(callback: (role: "controller" | "subject") => void): void {
        this.onGameStartingCallback = callback;
    }

    onGameStarted(callback: (playerId: string, x: number, y: number, players: Player[], maze: Maze, role: "controller" | "subject") => void): void {
        this.onGameStartedCallback = callback;
    }

    onSpawnFull(callback: () => void): void {
        this.onSpawnFullCallback = callback;
    }

    onPlayerJoined(callback: (player: Player) => void): void {
        this.onPlayerJoinedCallback = callback;
    }

    onPlayerMoved(callback: (playerId: string, x: number, y: number) => void): void {
        this.onPlayerMovedCallback = callback;
    }

    onPlayerLeft(callback: (playerId: string) => void): void {
        this.onPlayerLeftCallback = callback;
    }

    getPlayerId(): string | null {
        return this.playerId;
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
