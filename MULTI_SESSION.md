# Multi-Session Support

The server now supports multiple game sessions running in parallel, each identified by a unique human-readable ID.

## Features

### Human-Readable Session IDs

- Session IDs use memorable word combinations like `HappyBlueWhaleStorm`
- Format: **Adjective + Color + Animal + Noun** (e.g., `BraveGoldenEagleMountain`)
- Easy to share verbally or remember
- Over **1.9 million** unique combinations

### Automatic Session Management

- When a user opens the client, a session ID is automatically generated and added to the URL
- The URL can be shared with other players to join the same game session
- Each session maintains its own isolated game state

### Session Lifecycle

- Sessions are created automatically when a player connects with a new session ID
- Sessions remain active as long as players are connected
- Empty sessions are automatically cleaned up after 30 minutes of inactivity

## Usage

### Starting a New Session

1. Open the client in your browser (e.g., `http://localhost:5173/`)
2. A unique session ID will be automatically generated and added to the URL
   - Example: `http://localhost:5173/?s=HappyBlueWhaleStorm`
   - Format: Readable words like `BraveGoldenEagleMountain`

### Sharing a Session

1. Click the "Share Link" button in the UI to see your session URL
2. Click "Copy" to copy the URL to your clipboard
3. Share the URL with other players who want to join your session
4. When they open the URL, they'll automatically join your game session

### Multiple Sessions

- Different browser tabs or users can have different session IDs
- Each session is completely isolated from others
- Players can only see and interact with others in the same session

## Server Endpoints

### WebSocket Connection

```
ws://localhost:3001/ws/:sessionId
```

Connect to a specific game session. The session will be created if it doesn't exist.

### Create New Session

```
POST http://localhost:3001/sessions
```

Returns: `{ "sessionId": "HappyBlueWhaleStorm" }`

### List Active Sessions

```
GET http://localhost:3001/sessions
```

Returns: `{ "sessions": ["HappyBlueWhaleStorm", "BraveGoldenEagleMountain", ...], "count": 2 }`

### Health Check

```
GET http://localhost:3001/health
```

Returns: `{ "status": "ok" }`

## Technical Details

### Server Architecture

- `SessionManager` class manages multiple `GameState` instances
- Each session maintains its own:
  - Player list
  - Spawn points
  - Game state

### Client Architecture

- Session ID is stored in URL query parameter (`?s=HappyBlueWhaleStorm`)
- `NetworkManager` connects to WebSocket with session ID
- Session persists across page refreshes (as long as query parameter is preserved)
- Mnemonic IDs are easy to share verbally or type manually

### Mnemonic ID System

Session IDs are generated using four word lists:

- **40 Adjectives**: Happy, Brave, Clever, Swift, Mighty, etc.
- **30 Colors**: Red, Blue, Golden, Azure, Crimson, etc.
- **40 Animals**: Whale, Eagle, Tiger, Dragon, Phoenix, etc.
- **40 Nouns**: Storm, Mountain, River, Thunder, Star, etc.

**Total combinations**: 40 × 30 × 40 × 40 = **1,920,000** unique IDs

This provides excellent collision resistance while remaining human-friendly. Examples:

- `HappyBlueWhaleStorm`
- `BraveGoldenEagleMountain`
- `CleverAzureDragonThunder`
- `MightyRubyTigerOcean`

### Session Cleanup

- Sessions with no players are deleted after 30 minutes
- Timeout is reset whenever there's activity in the session
- Manual cleanup can be implemented if needed

## Development

### Running the Server

```bash
cd server
npm install
npm run dev
```

### Running the Client

```bash
cd client
npm install
npm run dev
```

## Future Enhancements

Potential improvements:

- Session naming/customization
- Password protection for private sessions
- Maximum players per session configuration
- Session browser/lobby
- Persistent session storage
