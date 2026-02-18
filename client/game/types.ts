export type Tile = "#" | "S" | string;

export interface Maze {
  width: number;
  height: number;
  name?: string;
  tiles: string[];
  exit?: { x: number; y: number };
}

export interface Player {
  id?: string; // Optional for backward compatibility
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  color?: string;
}

export type Role = "controller" | "subject" | null;

export interface ControllerViewport extends Player { }
