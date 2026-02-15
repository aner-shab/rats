import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { SessionManager } from "./session-manager.js";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import { randomBytes } from "crypto";

const fastify = Fastify({
    logger: true,
});

// Register WebSocket support
await fastify.register(websocket);

const sessionManager = new SessionManager();

// WebSocket route with session ID
fastify.register(async (fastify) => {
    fastify.get("/ws/:sessionId", { websocket: true }, (socket, req) => {
        const sessionId = (req.params as { sessionId: string }).sessionId;
        const gameState = sessionManager.getOrCreateSession(sessionId);
        const connectionId = randomBytes(8).toString("hex");
        let playerId: string | null = null;
        let playerRole: "subject" | "controller" | null = null;
        let inLobby = true;

        console.log(`New connection ${connectionId} to session ${sessionId}`);

        socket.on("message", (data) => {
            try {
                const message: ClientMessage = JSON.parse(data.toString());

                switch (message.type) {
                    case "join-lobby": {
                        playerId = connectionId;
                        const persistentId = message.persistentId;

                        // Check if player should reconnect to active game
                        if (gameState.isGameStarted()) {
                            const reconnectData = gameState.reconnectPlayer(playerId, persistentId, socket);
                            if (reconnectData) {
                                playerRole = reconnectData.role;
                                inLobby = false;

                                const { player, maze, role } = reconnectData;

                                // Send game-started with current state
                                const allPlayers = gameState.getOtherPlayers(playerId);
                                const response: ServerMessage = {
                                    type: "game-started",
                                    playerId,
                                    x: player.x,
                                    y: player.y,
                                    players: allPlayers,
                                    maze,
                                    role,
                                };
                                socket.send(JSON.stringify(response));

                                // Notify other players (only for subjects)
                                if (role === "subject") {
                                    const joinMessage: ServerMessage = {
                                        type: "player-joined",
                                        player: {
                                            id: playerId,
                                            x: player.x,
                                            y: player.y,
                                            renderX: player.x,
                                            renderY: player.y,
                                            color: player.color,
                                        },
                                    };
                                    gameState.broadcastToOthers(playerId, joinMessage);
                                }

                                console.log(`Player ${playerId} reconnected to game as ${role}`);
                                break;
                            } else {
                                // Reconnection failed during active game
                                console.error(`Failed to reconnect player with persistentId ${persistentId}`);
                                socket.close();
                                return;
                            }
                        }

                        const lobbyResult = gameState.addLobbyPlayer(playerId, persistentId, socket);
                        if (!lobbyResult) {
                            // This shouldn't happen now, but handle gracefully
                            console.error("Failed to add player to lobby");
                            break;
                        }

                        playerRole = lobbyResult.role;

                        // Send lobby joined confirmation
                        const response: ServerMessage = {
                            type: "lobby-joined",
                            playerId,
                            role: lobbyResult.role,
                            players: lobbyResult.players,
                        };
                        socket.send(JSON.stringify(response));

                        // Broadcast updated lobby to all players
                        const updateMessage: ServerMessage = {
                            type: "lobby-updated",
                            players: lobbyResult.players,
                        };
                        gameState.broadcastToLobby(updateMessage);
                        break;
                    }

                    case "set-ready": {
                        if (!playerId || !inLobby) return;

                        const players = gameState.setPlayerReady(playerId, message.isReady);

                        // Broadcast updated lobby
                        const updateMessage: ServerMessage = {
                            type: "lobby-updated",
                            players,
                        };
                        gameState.broadcastToLobby(updateMessage);

                        // Check if all players are ready
                        if (gameState.areAllPlayersReady()) {
                            console.log(`All players ready in session ${sessionId}, starting game...`);

                            // Notify all players game is starting
                            players.forEach(p => {
                                const startingMsg: ServerMessage = {
                                    type: "game-starting",
                                    role: p.role,
                                };
                                gameState.broadcastToLobby(startingMsg);
                            });

                            // Start the game
                            const spawnedPlayers = gameState.startGame();
                            inLobby = false;

                            // Send game-started to each player with their spawn position
                            spawnedPlayers.forEach((data, pid) => {
                                const allPlayers = gameState.getAllPlayers();

                                const gameStartedMsg: ServerMessage = {
                                    type: "game-started",
                                    playerId: pid,
                                    x: data.x,
                                    y: data.y,
                                    players: allPlayers.filter(p => p.id !== pid),
                                    maze: gameState.getMaze(),
                                    role: data.role,
                                };
                                data.socket.send(JSON.stringify(gameStartedMsg));
                            });
                        }
                        break;
                    }

                    case "set-name": {
                        if (!playerId || !inLobby) return;

                        const players = gameState.setPlayerName(playerId, message.name);

                        // Broadcast updated lobby
                        const updateMessage: ServerMessage = {
                            type: "lobby-updated",
                            players,
                        };
                        gameState.broadcastToLobby(updateMessage);
                        break;
                    }

                    case "set-color": {
                        if (!playerId || !inLobby) return;

                        const players = gameState.setPlayerColor(playerId, message.color);

                        // Broadcast updated lobby
                        const updateMessage: ServerMessage = {
                            type: "lobby-updated",
                            players,
                        };
                        gameState.broadcastToLobby(updateMessage);
                        break;
                    }

                    case "move": {
                        if (!playerId || inLobby) {
                            console.warn("Received move from player in lobby or not joined");
                            return;
                        }

                        const moved = gameState.movePlayer(playerId, message.dx, message.dy);

                        if (moved) {
                            const player = gameState.getPlayer(playerId);
                            if (player) {
                                const moveMessage: ServerMessage = {
                                    type: "player-moved",
                                    playerId: player.id,
                                    x: player.x,
                                    y: player.y,
                                };
                                gameState.broadcastToAll(moveMessage);
                                console.log(`Player ${playerId} moved to (${player.x}, ${player.y})`);
                            }
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        });

        socket.on("close", () => {
            if (!playerId) return;

            console.log(`Player ${playerId} (${playerRole}) disconnected`);

            // Check if game has started rather than relying on local inLobby variable
            if (!gameState.isGameStarted()) {
                // Player is in lobby
                gameState.removeLobbyPlayer(playerId);
                const players = gameState.getLobbyPlayers();
                const updateMessage: ServerMessage = {
                    type: "lobby-updated",
                    players,
                };
                gameState.broadcastToLobby(updateMessage);
            } else {
                // Player is in active game - save state for reconnection
                gameState.removePlayer(playerId);
                const playerLeftMessage: ServerMessage = {
                    type: "player-left",
                    playerId,
                };
                gameState.broadcastToAll(playerLeftMessage);
            }
        });

        socket.on("error", (error) => {
            console.error(`WebSocket error for player ${playerId}:`, error);
        });
    });
});

// Health check endpoint
fastify.get("/health", async () => {
    return { status: "ok" };
});

// Create new session endpoint
fastify.post("/sessions", async () => {
    const sessionId = sessionManager.createSession();
    return { sessionId };
});

// Get active sessions
fastify.get("/sessions", async () => {
    return {
        sessions: sessionManager.getActiveSessions(),
        count: sessionManager.getSessionCount(),
    };
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: "0.0.0.0" });
        console.log("Server listening on http://localhost:3001");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
