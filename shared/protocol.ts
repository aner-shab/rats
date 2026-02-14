// Shared types between client and server

export interface Player {
    id: string;
    x: number;
    y: number;
    renderX: number;
    renderY: number;
}

export interface Maze {
    width: number;
    height: number;
    name: string;
    tiles: string[];
}

// Client -> Server messages
export type ClientMessage =
    | { type: "join"; role: "subject" | "controller"; persistentId: string }
    | { type: "move"; dx: number; dy: number };

// Server -> Client messages
export type ServerMessage =
    | { type: "joined"; playerId: string; x: number; y: number; players: Player[]; maze: Maze }
    | { type: "spawn-full" }
    | { type: "player-joined"; player: Player }
    | { type: "player-moved"; playerId: string; x: number; y: number }
    | { type: "player-left"; playerId: string };
