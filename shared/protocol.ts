// Shared types between client and server

export interface Player {
    id: string;
    x: number;
    y: number;
    renderX: number;
    renderY: number;
    color?: string;
}

export interface Maze {
    width: number;
    height: number;
    name: string;
    tiles: string[];
}

export interface LobbyPlayer {
    id: string;
    persistentId: string;
    role: "controller" | "subject";
    isReady: boolean;
    name?: string;
    color?: string;
}

// Client -> Server messages
export type ClientMessage =
    | { type: "join-lobby"; persistentId: string }
    | { type: "set-ready"; isReady: boolean }
    | { type: "set-name"; name: string }
    | { type: "set-color"; color: string }
    | { type: "move"; dx: number; dy: number };

// Server -> Client messages
export type ServerMessage =
    | { type: "lobby-joined"; playerId: string; role: "controller" | "subject"; players: LobbyPlayer[] }
    | { type: "lobby-updated"; players: LobbyPlayer[] }
    | { type: "game-starting"; role: "controller" | "subject" }
    | { type: "game-started"; playerId: string; x: number; y: number; players: Player[]; maze: Maze; role: "controller" | "subject" }
    | { type: "spawn-full" }
    | { type: "player-joined"; player: Player }
    | { type: "player-moved"; playerId: string; x: number; y: number }
    | { type: "player-left"; playerId: string };
