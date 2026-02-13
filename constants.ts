export const VIEWPORT_SIZE = 11; // 11x11 tiles
export const CAMERA_SPEED = 0.1; // lerp factor (0-1)
export const MOVE_DURATION = 150; // ms
export const DEBUG = false;

export const CANVAS = document.getElementById("game") as HTMLCanvasElement;
export const CTX = CANVAS.getContext("2d")!;