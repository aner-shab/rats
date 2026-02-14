import type { ClientMessage, ServerMessage, Player, Maze } from "../../../shared/protocol";

export class NetworkManager {
    private ws: WebSocket | null = null;
    private playerId: string | null = null;
    private onJoinedCallback: ((playerId: string, x: number, y: number, players: Player[], maze: Maze) => void) | null = null;
    private onSpawnFullCallback: (() => void) | null = null;
    private onPlayerJoinedCallback: ((player: Player) => void) | null = null;
    private onPlayerMovedCallback: ((playerId: string, x: number, y: number) => void) | null = null;
    private onPlayerLeftCallback: ((playerId: string) => void) | null = null;

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
            case "joined":
                this.playerId = message.playerId;
                if (this.onJoinedCallback) {
                    this.onJoinedCallback(message.playerId, message.x, message.y, message.players, message.maze);
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

    joinAsSubject(): void {
        this.sendMessage({ type: "join", role: "subject" });
    }

    joinAsController(): void {
        this.sendMessage({ type: "join", role: "controller" });
    }

    sendMove(dx: number, dy: number): void {
        this.sendMessage({ type: "move", dx, dy });
    }

    onJoined(callback: (playerId: string, x: number, y: number, players: Player[], maze: Maze) => void): void {
        this.onJoinedCallback = callback;
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
