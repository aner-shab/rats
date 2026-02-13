# Rats Game - Multiplayer Server

WebSocket-based multiplayer server for the Rats maze game.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Production

```bash
npm run build
npm start
```

## Architecture

- **Fastify** - Fast and low overhead web framework
- **@fastify/websocket** - WebSocket support
- **Server-authoritative** - All moves validated server-side
- **Spawn management** - Tracks available spawn points (S tiles)

## WebSocket Protocol

### Client → Server

```typescript
{ type: "join", role: "subject" }
{ type: "move", dx: number, dy: number }
```

### Server → Client

```typescript
{ type: "joined", playerId: string, x: number, y: number, players: Player[] }
{ type: "spawn-full" }
{ type: "player-joined", player: Player }
{ type: "player-moved", playerId: string, x: number, y: number }
{ type: "player-left", playerId: string }
```
