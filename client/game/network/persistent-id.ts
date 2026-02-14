import { generateMnemonicId } from "../../../shared/id-generator";

const STORAGE_KEY = "rats-player-id";

/**
 * Get or create a persistent player ID stored in localStorage.
 * This ID persists across sessions so players can rejoin and maintain their state.
 */
export function getPersistentPlayerId(): string {
    let playerId = localStorage.getItem(STORAGE_KEY);

    if (!playerId) {
        playerId = generateMnemonicId();
        localStorage.setItem(STORAGE_KEY, playerId);
        console.log(`Generated new persistent player ID: ${playerId}`);
    } else {
        console.log(`Retrieved persistent player ID: ${playerId}`);
    }

    return playerId;
}

/**
 * Clear the persistent player ID from localStorage.
 * Useful for testing or if a player wants to reset their identity.
 */
export function clearPersistentPlayerId(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log("Cleared persistent player ID");
}

/**
 * Get the current persistent player ID without generating a new one.
 * Returns null if no ID exists.
 */
export function getCurrentPlayerId(): string | null {
    return localStorage.getItem(STORAGE_KEY);
}

// Expose to window for debugging in console
if (typeof window !== "undefined") {
    (window as any).getPlayerId = getCurrentPlayerId;
    (window as any).clearPlayerId = clearPersistentPlayerId;
}
