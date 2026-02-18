# WebRTC Voice Communication Implementation Guide

**Date**: February 18, 2026
**Status**: Stashed for future implementation

## Overview

This document describes the complete implementation of proximity-based WebRTC voice communication for the Rats maze game. The voice system is modular, Subject-only, and features proximity-based volume control with visual speaking indicators.

## Requirements Implemented

1. ✅ Module is self-contained and easily interchangeable
2. ✅ Only external functions exposed (library-like interface)
3. ✅ Voice communication available only to Subject players
4. ✅ Proximity-based volume: 100% same tile → 80% adjacent → 60% 2 tiles → 20% 3 tiles → 0% 4+ tiles
5. ✅ Library agnostic with swappable adapter pattern
6. ✅ Visual speaking indicator above player tiles (respects fog of war)

---

## File Structure

### New Files Created

```
client/game/voice/
├── types.ts                    # Type definitions
├── proximity.ts                # Proximity calculator
├── manager.ts                  # Voice manager
├── index.ts                    # Public API
├── README.md                   # Documentation
└── adapters/
    └── native.ts               # Native WebRTC implementation
```

### Modified Files

1. `shared/protocol.ts` - Protocol extensions
2. `server/src/game-state.ts` - Voice peer management
3. `server/src/index.ts` - Signal relay handling
4. `client/game/network/manager.ts` - Voice callbacks
5. `client/game/engine/render.ts` - Speaking indicators
6. `client/main.ts` - Voice integration
7. `client/index.html` - Voice UI controls

---

## Implementation Details

### 1. Voice Types (`client/game/voice/types.ts`)

**Complete File Content:**

```typescript
// Voice communication types

import type { NetworkManager } from "../network/manager";

export interface VoiceConfig {
  adapter: "native" | "simple-peer";
  proximityLevels: ProximityLevel[];
  networkManager: NetworkManager;
}

export interface ProximityLevel {
  distance: number;
  volume: number;
}

export interface PlayerVoiceState {
  playerId: string;
  persistentId: string;
  x: number;
  y: number;
  isSpeaking: boolean;
}

export interface AdapterConfig {
  onSignal: (targetPeerId: string, signal: any) => void;
  onSpeaking: (peerId: string, speaking: boolean) => void;
  onPeerConnected: (peerId: string) => void;
  onPeerDisconnected: (peerId: string) => void;
}

export interface WebRTCAdapter {
  initialize(config: AdapterConfig): Promise<void>;
  connect(peerId: string, initiator: boolean): Promise<void>;
  handleSignal(peerId: string, signal: any): Promise<void>;
  disconnect(peerId: string): void;
  setVolume(peerId: string, volume: number): void;
  destroy(): void;
}
```

### 2. Proximity Calculator (`client/game/voice/proximity.ts`)

**Complete File Content:**

```typescript
// Proximity-based volume calculation

import type { ProximityLevel } from "./types";

export class ProximityCalculator {
  private proximityLevels: ProximityLevel[];

  constructor(proximityLevels: ProximityLevel[]) {
    // Sort by distance to ensure proper lookups
    this.proximityLevels = [...proximityLevels].sort(
      (a, b) => a.distance - b.distance,
    );
  }

  /**
   * Calculate audio volume based on tile distance
   * Uses Manhattan distance (taxicab distance)
   */
  calculateVolume(x1: number, y1: number, x2: number, y2: number): number {
    const distance = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    return this.getVolumeForDistance(distance);
  }

  /**
   * Get volume for a specific distance using proximity levels
   */
  private getVolumeForDistance(distance: number): number {
    // Find exact match or interpolate
    for (let i = 0; i < this.proximityLevels.length; i++) {
      const level = this.proximityLevels[i];

      if (distance === level.distance) {
        return level.volume;
      }

      // If distance is between this level and the next, interpolate
      if (i < this.proximityLevels.length - 1) {
        const nextLevel = this.proximityLevels[i + 1];
        if (distance > level.distance && distance < nextLevel.distance) {
          return this.interpolate(
            level.distance,
            level.volume,
            nextLevel.distance,
            nextLevel.volume,
            distance,
          );
        }
      }
    }

    // If distance is beyond all defined levels, return the last level's volume
    return this.proximityLevels[this.proximityLevels.length - 1].volume;
  }

  /**
   * Linear interpolation between two points
   */
  private interpolate(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
  ): number {
    if (x2 === x1) return y1;
    return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
  }
}
```

### 3. Native WebRTC Adapter (`client/game/voice/adapters/native.ts`)

Create new file with this complete content:

```typescript
// Native WebRTC implementation adapter

import type { WebRTCAdapter, AdapterConfig } from "../types";

interface PeerConnection {
  peer: RTCPeerConnection;
  audioElement: HTMLAudioElement;
  analyser: AnalyserNode | null;
  dataArray: Uint8Array | null;
}

export class NativeWebRTCAdapter implements WebRTCAdapter {
  private config: AdapterConfig | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private speakingCheckInterval: number | null = null;
  private speakingStates: Map<string, boolean> = new Map();

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;

    // Get microphone access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Create audio context for speaking detection
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();

      // Start checking for speaking
      this.startSpeakingDetection();

      console.log("WebRTC initialized with microphone access");
    } catch (error) {
      console.error("Failed to get microphone access:", error);
      throw new Error("Microphone access denied");
    }
  }

  async connect(peerId: string, initiator: boolean): Promise<void> {
    if (!this.config || !this.localStream) {
      throw new Error("Adapter not initialized");
    }

    console.log(`Connecting to peer ${peerId} (initiator: ${initiator})`);

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Add local stream to peer connection
    this.localStream.getTracks().forEach((track) => {
      peer.addTrack(track, this.localStream!);
    });

    // Create audio element for remote stream
    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    audioElement.volume = 1.0;

    // Handle remote stream
    peer.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      audioElement.srcObject = event.streams[0];

      // Set up audio analysis for speaking detection
      if (this.audioContext) {
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = this.audioContext.createMediaStreamSource(
          event.streams[0],
        );
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);

        const connection = this.peers.get(peerId);
        if (connection) {
          connection.analyser = analyser;
          connection.dataArray = dataArray;
        }
      }
    };

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.config!.onSignal(peerId, {
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state
    peer.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state: ${peer.connectionState}`);
      if (peer.connectionState === "connected") {
        this.config!.onPeerConnected(peerId);
      } else if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "failed"
      ) {
        this.config!.onPeerDisconnected(peerId);
        this.disconnect(peerId);
      }
    };

    this.peers.set(peerId, {
      peer,
      audioElement,
      analyser: null,
      dataArray: null,
    });

    // If initiator, create offer
    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.config.onSignal(peerId, {
        type: "offer",
        sdp: offer,
      });
    }
  }

  async handleSignal(peerId: string, signal: any): Promise<void> {
    const connection = this.peers.get(peerId);
    if (!connection) {
      console.warn(`Received signal for unknown peer ${peerId}`);
      return;
    }

    const { peer } = connection;

    try {
      if (signal.type === "offer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.config!.onSignal(peerId, {
          type: "answer",
          sdp: answer,
        });
      } else if (signal.type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === "candidate") {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error(`Error handling signal from ${peerId}:`, error);
    }
  }

  disconnect(peerId: string): void {
    const connection = this.peers.get(peerId);
    if (connection) {
      connection.peer.close();
      connection.audioElement.remove();
      this.peers.delete(peerId);
      console.log(`Disconnected from peer ${peerId}`);
    }
  }

  setVolume(peerId: string, volume: number): void {
    const connection = this.peers.get(peerId);
    if (connection) {
      connection.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  private startSpeakingDetection(): void {
    if (!this.localStream || !this.audioContext) return;

    // Set up analyser for local stream
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;

    this.speakingCheckInterval = window.setInterval(() => {
      // Check local speaking
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeaking = average > 20; // Threshold for speaking detection

      if (isSpeaking !== lastSpeaking) {
        lastSpeaking = isSpeaking;
        // Note: We'll handle broadcasting our speaking state through the manager
      }

      // Check remote peers speaking
      this.peers.forEach((connection, peerId) => {
        if (connection.analyser && connection.dataArray) {
          // @ts-ignore - Uint8Array type inference issue
          connection.analyser.getByteFrequencyData(connection.dataArray);
          const avg =
            connection.dataArray.reduce((a, b) => a + b) /
            connection.dataArray.length;
          const speaking = avg > 20;

          const wasSpeaking = this.speakingStates.get(peerId) || false;
          if (speaking !== wasSpeaking) {
            this.speakingStates.set(peerId, speaking);
            this.config!.onSpeaking(peerId, speaking);
          }
        }
      });
    }, 100); // Check every 100ms
  }

  destroy(): void {
    // Stop speaking detection
    if (this.speakingCheckInterval !== null) {
      clearInterval(this.speakingCheckInterval);
    }

    // Disconnect all peers
    this.peers.forEach((_, peerId) => this.disconnect(peerId));
    this.peers.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log("WebRTC adapter destroyed");
  }
}
```

### 4. Voice Manager (`client/game/voice/manager.ts`)

Create new file with this complete content:

```typescript
// Voice communication manager

import type { VoiceConfig, PlayerVoiceState, WebRTCAdapter } from "./types";
import { ProximityCalculator } from "./proximity";
import { NativeWebRTCAdapter } from "./adapters/native";

export class VoiceManager {
  private config: VoiceConfig;
  private adapter: WebRTCAdapter;
  private proximityCalculator: ProximityCalculator;
  private players: Map<string, PlayerVoiceState> = new Map();
  private persistentIdToPlayerId: Map<string, string> = new Map();
  private myPosition: { x: number; y: number } = { x: 0, y: 0 };
  private myPlayerId: string | null = null;

  constructor(config: VoiceConfig) {
    this.config = config;
    this.proximityCalculator = new ProximityCalculator(config.proximityLevels);

    // Create the appropriate adapter
    if (config.adapter === "native") {
      this.adapter = new NativeWebRTCAdapter();
    } else {
      throw new Error(`Unsupported adapter: ${config.adapter}`);
    }
  }

  async initialize(myPlayerId: string): Promise<void> {
    this.myPlayerId = myPlayerId;

    // Initialize the WebRTC adapter
    await this.adapter.initialize({
      onSignal: (targetPeerId, signal) => {
        // Send signal through network manager
        this.config.networkManager.sendVoiceSignal(targetPeerId, signal);
      },
      onSpeaking: (peerId, speaking) => {
        // When a remote peer starts/stops speaking
        const playerId = this.persistentIdToPlayerId.get(peerId);
        if (playerId) {
          const player = this.players.get(playerId);
          if (player) {
            player.isSpeaking = speaking;
          }
        }
      },
      onPeerConnected: (peerId) => {
        console.log(`Voice peer connected: ${peerId}`);
        // Update volume based on current position
        this.updateVolumeForPeer(peerId);
      },
      onPeerDisconnected: (peerId) => {
        console.log(`Voice peer disconnected: ${peerId}`);
      },
    });

    console.log("VoiceManager initialized");
  }

  async registerPlayer(playerId: string, persistentId: string): Promise<void> {
    console.log(`Registering player ${playerId} (${persistentId}) for voice`);

    this.players.set(playerId, {
      playerId,
      persistentId,
      x: 0,
      y: 0,
      isSpeaking: false,
    });
    this.persistentIdToPlayerId.set(persistentId, playerId);

    // Don't connect to ourselves
    if (playerId === this.myPlayerId) {
      return;
    }

    // Determine if we should initiate the connection
    // Use a deterministic rule: player with lower ID initiates
    const shouldInitiate = this.myPlayerId! < playerId;

    // Connect to the peer
    await this.adapter.connect(persistentId, shouldInitiate);
  }

  unregisterPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.adapter.disconnect(player.persistentId);
      this.persistentIdToPlayerId.delete(player.persistentId);
      this.players.delete(playerId);
      console.log(`Unregistered player ${playerId} from voice`);
    }
  }

  updatePlayerPosition(playerId: string, x: number, y: number): void {
    const player = this.players.get(playerId);
    if (player) {
      player.x = x;
      player.y = y;

      // Update volume based on new position
      this.updateVolumeForPeer(player.persistentId);
    }
  }

  updateMyPosition(x: number, y: number): void {
    this.myPosition = { x, y };

    // Update volumes for all players based on new position
    this.players.forEach((player) => {
      this.updateVolumeForPeer(player.persistentId);
    });
  }

  handleVoiceSignal(fromPersistentId: string, signal: any): void {
    // Handle incoming WebRTC signal
    this.adapter.handleSignal(fromPersistentId, signal);
  }

  isSpeaking(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player ? player.isSpeaking : false;
  }

  private updateVolumeForPeer(persistentId: string): void {
    const playerId = this.persistentIdToPlayerId.get(persistentId);
    if (!playerId) return;

    const player = this.players.get(playerId);
    if (!player) return;

    // Calculate volume based on proximity
    const volume = this.proximityCalculator.calculateVolume(
      this.myPosition.x,
      this.myPosition.y,
      player.x,
      player.y,
    );

    this.adapter.setVolume(persistentId, volume);
  }

  destroy(): void {
    this.adapter.destroy();
    this.players.clear();
    this.persistentIdToPlayerId.clear();
    console.log("VoiceManager destroyed");
  }
}
```

### 5. Public API (`client/game/voice/index.ts`)

Create new file with this complete content:

```typescript
// Voice module public API

export { VoiceManager } from "./manager";
export { ProximityCalculator } from "./proximity";
export type {
  VoiceConfig,
  ProximityLevel,
  PlayerVoiceState,
  WebRTCAdapter,
  AdapterConfig,
} from "./types";

import { VoiceManager } from "./manager";
import type { VoiceConfig } from "./types";

/**
 * Create and initialize a voice manager
 * This is the main entry point for voice communication
 */
export async function createVoiceManager(
  config: VoiceConfig,
  myPlayerId: string,
): Promise<VoiceManager> {
  const manager = new VoiceManager(config);
  await manager.initialize(myPlayerId);
  return manager;
}
```

---

## Protocol Extensions

### Modify `shared/protocol.ts`

Add voice message types to the protocol:

**In ClientMessage union type:**

```typescript
| { type: "voice-signal"; targetPersistentId: string; signal: any };
```

**In ServerMessage union type:**

```typescript
| { type: "voice-peers"; peers: Array<{ playerId: string; persistentId: string }> }
| { type: "voice-signal"; fromPersistentId: string; signal: any }
| { type: "voice-peer-joined"; playerId: string; persistentId: string }
| { type: "voice-peer-left"; playerId: string };
```

---

## Server-Side Changes

### Modify `server/src/game-state.ts`

Add these methods at the end of the GameState class (before the closing brace):

```typescript
    // Voice communication methods
    getSubjectPlayers(): Array<{ playerId: string; persistentId: string }> {
        return Array.from(this.players.values())
            .filter((p) => p.id !== this.controllerPlayerId)
            .map((p) => ({ playerId: p.id, persistentId: p.persistentId }));
    }

    sendVoiceSignal(targetPersistentId: string, fromPersistentId: string, signal: any): boolean {
        // Find the target player by persistent ID
        const targetPlayer = Array.from(this.players.values())
            .find(p => p.persistentId === targetPersistentId);

        if (targetPlayer && targetPlayer.socket.readyState === 1) {
            const message = {
                type: "voice-signal",
                fromPersistentId,
                signal
            };
            targetPlayer.socket.send(JSON.stringify(message));
            return true;
        }

        return false;
    }

    broadcastVoicePeerJoined(playerId: string, persistentId: string): void {
        // Only broadcast subject players (exclude controller)
        if (playerId === this.controllerPlayerId) return;

        const message = {
            type: "voice-peer-joined",
            playerId,
            persistentId
        };
        const payload = JSON.stringify(message);

        this.players.forEach((player) => {
            // Don't send to the player who just joined or the controller
            if (player.id !== playerId &&
                player.id !== this.controllerPlayerId &&
                player.socket.readyState === 1) {
                player.socket.send(payload);
            }
        });
    }

    broadcastVoicePeerLeft(playerId: string): void {
        // Only broadcast for subject players (exclude controller)
        if (playerId === this.controllerPlayerId) return;

        const message = {
            type: "voice-peer-left",
            playerId
        };
        const payload = JSON.stringify(message);

        this.players.forEach((player) => {
            if (player.id !== playerId &&
                player.id !== this.controllerPlayerId &&
                player.socket.readyState === 1) {
                player.socket.send(payload);
            }
        });
    }
```

### Modify `server/src/index.ts`

**1. Add voice-signal message handler** (in the switch statement after the "move" case):

```typescript
                    case "voice-signal": {
                        if (!playerId || !gameState.isGameStarted()) {
                            console.warn("Received voice signal from player not in game");
                            return;
                        }

                        // Only subjects can use voice communication
                        if (playerRole !== "subject") {
                            console.warn("Controller attempted to use voice communication");
                            return;
                        }

                        // Get the sender's persistent ID
                        const senderPlayer = gameState.getPlayer(playerId);
                        if (!senderPlayer) return;

                        // Relay the signal to the target peer
                        const relayed = gameState.sendVoiceSignal(
                            message.targetPersistentId,
                            (senderPlayer as any).persistentId,
                            message.signal
                        );

                        if (!relayed) {
                            console.warn(`Failed to relay voice signal to ${message.targetPersistentId}`);
                        }
                        break;
                    }
```

**2. Send voice peers on game start** (in the game-started message loop, after sending gameStartedMsg):

```typescript
// Send voice peers to subjects only
if (data.role === "subject") {
  const voicePeers = gameState
    .getSubjectPlayers()
    .filter((p) => p.playerId !== pid);
  const voicePeersMsg: ServerMessage = {
    type: "voice-peers",
    peers: voicePeers,
  };
  data.socket.send(JSON.stringify(voicePeersMsg));
}
```

**3. Send voice peers on reconnect** (in the reconnection handling, after the player-joined broadcast for subjects):

```typescript
// Send voice peers to the reconnecting subject
const voicePeers = gameState
  .getSubjectPlayers()
  .filter((p) => p.playerId !== playerId);
const voicePeersMsg: ServerMessage = {
  type: "voice-peers",
  peers: voicePeers,
};
socket.send(JSON.stringify(voicePeersMsg));

// Notify other subjects about the new voice peer
gameState.broadcastVoicePeerJoined(playerId, persistentId);
```

**4. Notify voice peer left on disconnect** (in the socket close handler, after broadcastToAll playerLeftMessage for active game):

```typescript
// Notify other subjects about the voice peer leaving (only if subject)
if (playerRole === "subject") {
  gameState.broadcastVoicePeerLeft(playerId);
}
```

---

## Client-Side Changes

### Modify `client/game/network/manager.ts`

**1. Add callback properties** (with other callback properties at the top):

```typescript
    private onVoicePeersCallback: ((peers: Array<{ playerId: string; persistentId: string }>) => void) | null = null;
    private onVoiceSignalCallback: ((fromPersistentId: string, signal: any) => void) | null = null;
    private onVoicePeerJoinedCallback: ((playerId: string, persistentId: string) => void) | null = null;
    private onVoicePeerLeftCallback: ((playerId: string) => void) | null = null;
```

**2. Add message handlers** (in handleServerMessage switch, after "player-left" case):

```typescript
            case "voice-peers":
                if (this.onVoicePeersCallback) {
                    this.onVoicePeersCallback(message.peers);
                }
                break;

            case "voice-signal":
                if (this.onVoiceSignalCallback) {
                    this.onVoiceSignalCallback(message.fromPersistentId, message.signal);
                }
                break;

            case "voice-peer-joined":
                if (this.onVoicePeerJoinedCallback) {
                    this.onVoicePeerJoinedCallback(message.playerId, message.persistentId);
                }
                break;

            case "voice-peer-left":
                if (this.onVoicePeerLeftCallback) {
                    this.onVoicePeerLeftCallback(message.playerId);
                }
                break;
```

**3. Add sendVoiceSignal method** (after sendMove method):

```typescript
    sendVoiceSignal(targetPersistentId: string, signal: any): void {
        this.sendMessage({ type: "voice-signal", targetPersistentId, signal });
    }
```

**4. Add callback setters** (after onPlayerLeft method):

```typescript
    onVoicePeers(callback: (peers: Array<{ playerId: string; persistentId: string }>) => void): void {
        this.onVoicePeersCallback = callback;
    }

    onVoiceSignal(callback: (fromPersistentId: string, signal: any) => void): void {
        this.onVoiceSignalCallback = callback;
    }

    onVoicePeerJoined(callback: (playerId: string, persistentId: string) => void): void {
        this.onVoicePeerJoinedCallback = callback;
    }

    onVoicePeerLeft(callback: (playerId: string) => void): void {
        this.onVoicePeerLeftCallback = callback;
    }
```

### Modify `client/game/engine/render.ts`

**1. Add voice manager reference and setter** (at the top, after imports):

```typescript
let voiceManagerRef: VoiceManager | null = null;

export function setVoiceManager(voiceManager: VoiceManager | null) {
  voiceManagerRef = voiceManager;
}
```

**2. Add speaking indicator drawing function** (before renderViewport function):

```typescript
function drawSpeakingIndicator(
  px: number,
  py: number,
  tileSize: number,
  alpha: number = 1.0,
) {
  const time = performance.now();
  const pulse = 0.7 + Math.sin(time / 200) * 0.3;
  const radius = tileSize / 6;

  CTX.save();
  CTX.globalAlpha = pulse * alpha;
  CTX.fillStyle = "#4CAF50";
  CTX.beginPath();
  CTX.arc(px + tileSize / 2, py - tileSize / 6, radius, 0, Math.PI * 2);
  CTX.fill();
  CTX.restore();
}
```

**3. Draw speaking indicators** (after the subject rendering loop, before the "Draw black tiles" section):

```typescript
// Draw speaking indicators (before fog overlay to respect visibility)
if (voiceManagerRef && fogged && visible) {
  positionGroups.forEach((playersAtPos) => {
    playersAtPos.forEach((subject) => {
      if (subject.id && voiceManagerRef!.isSpeaking(subject.id)) {
        const subjectPx =
          CANVAS.width / 2 + (subject.renderX - viewportX) * TILE_SIZE;
        const subjectPy =
          CANVAS.height / 2 + (subject.renderY - viewportY) * TILE_SIZE;

        // Calculate alpha based on distance (same logic as subject rendering)
        const isMe = subject === me || subject.id === me.id;
        let alpha = 1.0;

        if (!isMe) {
          const dx = subject.renderX - me.x;
          const dy = subject.renderY - me.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const fadeStart = 1.5;
          const fadeEnd = 2.5;

          if (distance > fadeStart) {
            alpha = Math.max(
              0,
              1 - (distance - fadeStart) / (fadeEnd - fadeStart),
            );
          }
        }

        // Check if the subject's tile is visible
        const subjectTileX = Math.floor(subject.renderX);
        const subjectTileY = Math.floor(subject.renderY);
        if (visible.has(`${subjectTileX},${subjectTileY}`)) {
          drawSpeakingIndicator(subjectPx, subjectPy, TILE_SIZE, alpha);
        }
      }
    });
  });
}
```

**4. Update imports** (at the top):

```typescript
import type { VoiceManager } from "../voice";
```

### Modify `client/main.ts`

**1. Add imports** (at the top):

```typescript
import { createVoiceManager, type VoiceManager } from "./game/voice";
import { setVoiceManager } from "./game/engine/render";
```

**2. Add voiceManager variable** (with other state variables):

```typescript
let voiceManager: VoiceManager | null = null;
```

**3. Update render imports** (in the import statement):

```typescript
import {
  renderViewport,
  resizeCanvas,
  setVoiceManager,
} from "./game/engine/render";
```

**4. Initialize voice manager for subjects** (in onGameStarted callback, after setupInput and resizeCanvas):

```typescript
// Initialize voice communication for subjects
if (assignedRole === "subject") {
  createVoiceManager(
    {
      adapter: "native",
      proximityLevels: [
        { distance: 0, volume: 1.0 }, // same tile
        { distance: 1, volume: 0.8 }, // adjacent
        { distance: 2, volume: 0.6 }, // 2 tiles away
        { distance: 3, volume: 0.2 }, // 3 tiles away
        { distance: 4, volume: 0.0 }, // 4+ tiles away (silence)
      ],
      networkManager: networkManager!,
    },
    playerId,
  )
    .then((vm) => {
      voiceManager = vm;
      setVoiceManager(vm);
      console.log("Voice manager initialized");

      // Show voice controls UI
      const voiceControls = document.getElementById("voiceControls");
      if (voiceControls) {
        voiceControls.classList.add("show");
      }

      // Update my position
      voiceManager.updateMyPosition(x, y);

      // Register existing players
      players.forEach((player) => {
        if (player.id) {
          // We need persistent IDs which we'll get from voice-peers message
        }
      });
    })
    .catch((error) => {
      console.error("Failed to initialize voice manager:", error);
      // Show a non-blocking notification
      const voiceError = document.createElement("div");
      voiceError.className = "voice-error";
      voiceError.textContent =
        "Voice communication unavailable. Check microphone permissions.";
      document.body.appendChild(voiceError);
      setTimeout(() => voiceError.remove(), 5000);

      // Show voice controls as inactive
      const voiceControls = document.getElementById("voiceControls");
      const voiceIndicator = document.getElementById("voiceIndicator");
      const voiceStatusText = document.getElementById("voiceStatusText");
      if (voiceControls && voiceIndicator && voiceStatusText) {
        voiceControls.classList.add("show");
        voiceIndicator.classList.add("inactive");
        voiceStatusText.textContent = "Voice: Unavailable";
      }
    });
}
```

**5. Add voice network handlers** (after onSpawnFull, before onPlayerJoined):

```typescript
// Voice communication handlers
networkManager.onVoicePeers((peers) => {
  console.log("Received voice peers:", peers);
  if (voiceManager) {
    // Register all peers
    peers.forEach((peer) => {
      voiceManager!.registerPlayer(peer.playerId, peer.persistentId);

      // Update position if we have it
      const player = remotePlayers.get(peer.playerId);
      if (player) {
        voiceManager!.updatePlayerPosition(peer.playerId, player.x, player.y);
      }
    });
  }
});

networkManager.onVoiceSignal((fromPersistentId, signal) => {
  if (voiceManager) {
    voiceManager.handleVoiceSignal(fromPersistentId, signal);
  }
});

networkManager.onVoicePeerJoined((playerId, persistentId) => {
  console.log(`Voice peer joined: ${playerId}`);
  if (voiceManager) {
    voiceManager.registerPlayer(playerId, persistentId);

    // Update position if we have it
    const player = remotePlayers.get(playerId);
    if (player) {
      voiceManager.updatePlayerPosition(playerId, player.x, player.y);
    }
  }
});

networkManager.onVoicePeerLeft((playerId) => {
  console.log(`Voice peer left: ${playerId}`);
  if (voiceManager) {
    voiceManager.unregisterPlayer(playerId);
  }
});
```

**6. Update voice positions on player move** (in onPlayerMoved, after updating player position):

```typescript
// Update voice manager with new position
if (voiceManager) {
  voiceManager.updatePlayerPosition(playerId, x, y);
}
```

And also for local player:

```typescript
// Update voice manager with my new position
if (voiceManager) {
  voiceManager.updateMyPosition(x, y);
}
```

### Modify `client/index.html`

**1. Add voice UI styles** (in the `<style>` section, before `</style>`):

```css
.voice-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 15px 20px;
  border-radius: 8px;
  border: 2px solid #555;
  color: white;
  display: none;
  z-index: 1000;
  font-size: 14px;
}

.voice-controls.show {
  display: block;
}

.voice-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.voice-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4caf50;
  animation: pulse 2s infinite;
}

.voice-indicator.inactive {
  background: #666;
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.voice-error {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(244, 67, 54, 0.9);
  padding: 15px 20px;
  border-radius: 8px;
  border: 2px solid #d32f2f;
  color: white;
  z-index: 2000;
  font-size: 14px;
  max-width: 300px;
}

.voice-info {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}
```

**2. Add voice controls HTML** (in game-container div, after the canvas):

```html
<div class="voice-controls" id="voiceControls">
  <div class="voice-status">
    <div class="voice-indicator" id="voiceIndicator"></div>
    <span id="voiceStatusText">Voice: Active</span>
  </div>
  <div class="voice-info">Proximity-based voice chat enabled</div>
</div>
```

---

## Testing Instructions

1. **Start the server:**

   ```bash
   cd server
   npm run dev
   ```

2. **Start the client:**

   ```bash
   cd client
   npm run dev
   ```

3. **Open multiple browser windows:**
   - First player becomes Controller (no voice)
   - Additional players become Subjects (with voice)
   - Allow microphone access when prompted

4. **Test proximity:**
   - Move Subjects close together → hear clearly
   - Move apart → volume decreases
   - Move 4+ tiles away → silence

5. **Test speaking indicators:**
   - Talk into microphone
   - Green pulsing circle should appear above your player
   - Other players should see your indicator
   - Indicator should be hidden by fog of war

---

## Technical Architecture

### Adapter Pattern

The voice system uses an adapter pattern to support multiple WebRTC implementations:

- `WebRTCAdapter` interface defines the contract
- `NativeWebRTCAdapter` implements using browser APIs
- Easy to add `SimplePeerAdapter`, `AgoraAdapter`, etc.

### Proximity System

- Uses Manhattan distance (taxicab geometry)
- Linear interpolation between defined levels
- Configurable distance thresholds

### WebRTC Flow

1. Subject joins → receives peer list
2. Deterministic initiator (lower ID starts)
3. Signaling via server (offer/answer/ICE)
4. Peer-to-peer audio connection
5. Volume adjusted by proximity

### Speaking Detection

- Frequency analysis every 100ms
- Threshold: 20 (average frequency)
- Local and remote detection
- Visual feedback via indicators

---

## Future Enhancements

Consider implementing:

- [ ] Mute/unmute button
- [ ] Volume control slider
- [ ] Push-to-talk mode
- [ ] Spatial stereo audio
- [ ] TURN servers for NAT traversal
- [ ] Voice quality settings
- [ ] Recording capabilities
- [ ] Voice activity meter

---

## Troubleshooting

**Microphone not working:**

- Check browser permissions
- Ensure HTTPS or localhost
- Check system microphone settings

**WebRTC connection fails:**

- Add TURN servers for production
- Check firewall settings
- Verify STUN server accessibility

**Speaking indicator not showing:**

- Check audio threshold (20)
- Verify fog of war logic
- Ensure player is registered

---

## Git Commands to Stash

```bash
# Stash all changes with a descriptive message
git add client/game/voice/
git add shared/protocol.ts
git add server/src/game-state.ts
git add server/src/index.ts
git add client/game/network/manager.ts
git add client/game/engine/render.ts
git add client/main.ts
git add client/index.html

git stash push -m "WebRTC proximity-based voice communication system"
```

To restore later:

```bash
git stash list
git stash apply stash@{0}  # or appropriate stash number
```

---

**End of Implementation Guide**
