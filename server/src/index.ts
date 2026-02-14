import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { SessionManager } from "./session-manager.js";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";

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
        let playerId: string | null = null;
        let playerRole: "subject" | "controller" | null = null;
        console.log(`New connection to session ${sessionId}`);

        socket.on("message", (data) => {
            try {
                const message: ClientMessage = JSON.parse(data.toString());

                switch (message.type) {
                    case "join": {
                        // Use the persistent ID from the client
                        playerId = message.persistentId;
                        playerRole = message.role;
                        console.log(`Player ${playerId} joined session ${sessionId} as ${message.role}`);

                        const maze = gameState.getMaze();
                        console.log(`Sending maze to ${message.role}: ${maze.name} (${maze.width}x${maze.height}, ${maze.tiles.length} tiles)`);

                        if (message.role === "controller") {
                            // Controllers only need maze data and player list, they don't spawn as players
                            gameState.addController(playerId, socket);
                            const joinedResponse: ServerMessage = {
                                type: "joined",
                                playerId: playerId,
                                x: 0,
                                y: 0,
                                players: gameState.getAllPlayers(),
                                maze: maze,
                            };
                            socket.send(JSON.stringify(joinedResponse));
                            console.log(`Controller ${playerId} connected`);
                            break;
                        }

                        // Subject joins as a player
                        const player = gameState.addPlayer(playerId, socket);

                        if (!player) {
                            const response: ServerMessage = { type: "spawn-full" };
                            socket.send(JSON.stringify(response));
                            console.log(`No spawn points available for player ${playerId}`);
                            return;
                        }

                        // Send joined confirmation with all current players
                        const joinedResponse: ServerMessage = {
                            type: "joined",
                            playerId: player.id,
                            x: player.x,
                            y: player.y,
                            players: gameState.getOtherPlayers(playerId),
                            maze: maze,
                        };
                        socket.send(JSON.stringify(joinedResponse));

                        // Notify other players
                        const playerJoinedMessage: ServerMessage = {
                            type: "player-joined",
                            player: {
                                id: player.id,
                                x: player.x,
                                y: player.y,
                                renderX: player.x,
                                renderY: player.y,
                            },
                        };
                        gameState.broadcastToOthers(playerId, playerJoinedMessage);

                        console.log(
                            `Player ${playerId} spawned at (${player.x}, ${player.y})`
                        );
                        break;
                    }

                    case "move": {
                        if (!playerId) {
                            console.warn("Received move from player who hasn't joined yet");
                            return;
                        }

                        const moved = gameState.movePlayer(playerId, message.dx, message.dy);

                        if (moved) {
                            const player = gameState.getPlayer(playerId);
                            if (player) {
                                // Broadcast movement to all players (including sender for confirmation)
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
            if (!playerId) {
                console.log("Connection closed before player joined");
                return;
            }

            console.log(`Player ${playerId} (${playerRole}) disconnected`);

            // Only remove from the appropriate collection based on role
            if (playerRole === "subject") {
                gameState.removePlayer(playerId);
            } else if (playerRole === "controller") {
                gameState.removeController(socket);
            }

            // Only broadcast player-left if they were a subject (actual player)
            if (playerRole === "subject") {
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
