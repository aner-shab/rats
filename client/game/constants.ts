export const VIEWPORT_SIZE = 11; // 11x11 tiles for subjects
export const CONTROLLER_VIEWPORT_SIZE = 22; // Larger view for controller
export const CAMERA_SPEED = 0.1; // lerp factor (0-1)
export const MOVE_DURATION = 150; // ms
export const DEBUG = false;

export const CANVAS = document.getElementById("game") as HTMLCanvasElement;
export const CTX = CANVAS.getContext("2d")!;

// Available player colors
export const PLAYER_COLORS = [
    { name: "Red", value: "#E53935" },
    { name: "Blue", value: "#1E88E5" },
    { name: "Green", value: "#43A047" },
    { name: "Yellow", value: "#FDD835" },
    { name: "Orange", value: "#FB8C00" },
    { name: "Purple", value: "#8E24AA" },
    { name: "Cyan", value: "#00ACC1" },
    { name: "Tan", value: "#D4A574" },
] as const;

export type PlayerColorName = typeof PLAYER_COLORS[number]['name'];
