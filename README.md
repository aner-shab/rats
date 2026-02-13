# Rats - Multiplayer Maze Game

A real-time multiplayer maze exploration game with WebSocket synchronization.

## Quick Start

### 1. Start the Server

```bash
cd server
npm install
npm run dev
```

Server runs on `ws://localhost:3001`

### 2. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

### 3. Play

1. Open multiple browser windows/tabs to `http://localhost:5173`
2. Click "Subject" in each window to spawn players
3. Use arrow keys to move around
4. Watch other players move in real-time!

## Features

- **Real-time Multiplayer** - WebSocket-based synchronization
- **Server-Authoritative** - All moves validated server-side
- **Spawn Management** - Each player gets a unique spawn point (S tiles)
- **Smooth Movement** - Client-side interpolation for fluid animations
- **Full/No Spawn Handling** - Graceful handling when all spawn points are used

## Architecture

```
┌─────────────┐         WebSocket          ┌─────────────────┐
│   Client    │◄──────────────────────────►│  Fastify Server │
│  (Browser)  │                             │   + WS Plugin   │
└─────────────┘                             └─────────────────┘
```

### Tech Stack

**Client:**

- TypeScript
- Vite
- Canvas Rendering
- WebSocket API

**Server:**

- Node.js
- Fastify
- @fastify/websocket
- TypeScript

## Project Structure

```
rats/
├── client/           # Game client
│   ├── game/
│   │   ├── engine/   # Input & rendering
│   │   ├── entities/ # Player & maze logic
│   │   └── network/  # WebSocket manager
│   └── main.ts       # Entry point
├── server/           # Multiplayer server
│   └── src/
│       ├── index.ts      # Fastify server
│       └── game-state.ts # Game state management
└── shared/           # Shared type definitions
    └── protocol.ts   # Network message types
```

## How It Works

1. **Player Joins**: Client connects via WebSocket and requests to join
2. **Spawn Assignment**: Server finds first available "S" tile and marks it used
3. **Movement**: Player sends move commands to server
4. **Validation**: Server validates moves against maze walls
5. **Broadcast**: Server broadcasts valid moves to all connected clients
6. **Interpolation**: Clients smoothly animate position changes

## Multiplayer Protocol

All communication uses JSON messages over WebSocket:

- `join` - Request to spawn in game
- `move` - Movement command (dx, dy)
- `joined` - Spawn confirmation with position
- `player-joined` - Notify of new player
- `player-moved` - Broadcast position update
- `player-left` - Player disconnected

## Development

Both client and server support hot reload for rapid development.
