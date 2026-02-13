import { GameState } from "./game-state.js";
import { generateMnemonicId } from "./id-generator.js";

export class SessionManager {
    private sessions: Map<string, GameState> = new Map();
    private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    createSession(): string {
        const sessionId = generateMnemonicId();
        const gameState = new GameState();
        this.sessions.set(sessionId, gameState);
        console.log(`Created new session: ${sessionId}`);
        this.resetSessionTimeout(sessionId);
        return sessionId;
    }

    getSession(sessionId: string): GameState | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.resetSessionTimeout(sessionId);
        }
        return session;
    }

    getOrCreateSession(sessionId: string): GameState {
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = new GameState();
            this.sessions.set(sessionId, session);
            console.log(`Created new session: ${sessionId}`);
        }
        this.resetSessionTimeout(sessionId);
        return session;
    }

    hasSession(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    deleteSession(sessionId: string): void {
        const timeout = this.sessionTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.sessionTimeouts.delete(sessionId);
        }
        this.sessions.delete(sessionId);
        console.log(`Deleted session: ${sessionId}`);
    }

    private resetSessionTimeout(sessionId: string): void {
        // Clear existing timeout
        const existingTimeout = this.sessionTimeouts.get(sessionId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout to auto-delete session if inactive
        const timeout = setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session && session.getAllPlayers().length === 0) {
                this.deleteSession(sessionId);
            }
        }, this.SESSION_TIMEOUT_MS);

        this.sessionTimeouts.set(sessionId, timeout);
    }

    getActiveSessions(): string[] {
        return Array.from(this.sessions.keys());
    }

    getSessionCount(): number {
        return this.sessions.size;
    }
}
